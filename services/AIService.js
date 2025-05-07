const OpenAI = require('openai');
const axios = require('axios');
const logger = require('./LoggingService');
const configService = require('./ConfigService');

/**
 * Service for interacting with AI APIs (OpenAI or Ollama)
 */
class AIService {
    /**
     * Creates a new instance of the AIService
     * @param {string} apiKey - OpenAI API key (defaults to config service)
     */
    constructor(apiKey = null) {
        // Use provided API key or get from config service
        this.apiKey = apiKey || configService.getApiKey();
        this.client = null;
        this.provider = configService.get('aiProvider', 'openai');
        this.ollamaConfig = configService.get('ollama', {
            baseUrl: 'http://localhost:11434',
            model: 'llama3'
        });
        
        // Initialize the client based on the provider
        this.initializeClient();
    }
    
    /**
     * Initializes the AI client
     */
    initializeClient() {
        try {
            if (this.provider === 'openai') {
                // Initialize OpenAI client
                if (this.apiKey) {
                    this.client = new OpenAI({
                        apiKey: this.apiKey
                    });
                    logger.info('AIService', 'OpenAI client initialized successfully');
                } else {
                    logger.warn('AIService', 'No OpenAI API key provided');
                    this.client = null;
                }
            } else if (this.provider === 'ollama') {
                // For Ollama, we'll use axios directly in the generate methods
                logger.info('AIService', `Ollama configured with baseUrl: ${this.ollamaConfig.baseUrl}, model: ${this.ollamaConfig.model}`);
                this.client = true; // Setting to true to indicate we have a working provider
            } else {
                logger.error('AIService', `Unknown AI provider: ${this.provider}`);
                this.client = null;
            }
        } catch (error) {
            logger.error('AIService', `Error initializing AI client: ${error.message}`);
            this.client = null;
        }
    }
    
    /**
     * Sets the API key and reinitializes the client
     * @param {string} apiKey - The OpenAI API key
     */
    async setApiKey(apiKey) {
        this.apiKey = apiKey;
        
        // Save to configuration
        await configService.setApiKey(apiKey);
        
        // Reinitialize client
        this.initializeClient();
    }
    
    /**
     * Checks if the service is ready to use
     * @returns {boolean} True if the client is initialized
     */
    isReady() {
        return !!this.client;
    }
    
    /**
     * Generates a response from the AI
     * @param {string} prompt - The user's prompt
     * @param {Object} options - Additional options for the request
     * @param {string} options.model - The model to use
     * @param {number} options.temperature - Controls randomness (0-2, defaults to 0.7)
     * @param {number} options.maxTokens - Maximum tokens to generate (defaults to 500)
     * @returns {Promise<string>} The generated response
     */
    async generateResponse(prompt, options = {}) {
        if (!this.isReady()) {
            if (this.provider === 'openai') {
                throw new Error('OpenAI client is not initialized. Set a valid API key first.');
            } else {
                throw new Error(`${this.provider} client is not initialized.`);
            }
        }
        
        if (this.provider === 'openai') {
            return this._generateOpenAIResponse(prompt, options);
        } else if (this.provider === 'ollama') {
            return this._generateOllamaResponse(prompt, options);
        } else {
            throw new Error(`Unsupported AI provider: ${this.provider}`);
        }
    }
    
    /**
     * Generates a response from OpenAI
     * @private
     */
    async _generateOpenAIResponse(prompt, options = {}) {
        const {
            model = configService.get('defaultModel', 'gpt-3.5-turbo'),
            temperature = 0.7,
            maxTokens = 500
        } = options;
        
        try {
            logger.debug('AIService', `Generating OpenAI response for prompt: "${prompt.substring(0, 50)}..."`);
            
            const response = await this.client.chat.completions.create({
                model,
                messages: [{ role: 'user', content: prompt }],
                temperature,
                max_tokens: maxTokens
            });
            
            const responseText = response.choices[0]?.message?.content || '';
            logger.debug('AIService', `Received OpenAI response: "${responseText.substring(0, 50)}..."`);
            
            return responseText;
        } catch (error) {
            logger.error('AIService', `Error generating OpenAI response: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Generates a response from Ollama
     * @private
     */
    async _generateOllamaResponse(prompt, options = {}) {
        const {
            model = this.ollamaConfig.model,
            temperature = 0.7,
            maxTokens = 500
        } = options;
        
        try {
            const baseUrl = this.ollamaConfig.baseUrl;
            const url = `${baseUrl}/api/generate`;
            
            logger.debug('AIService', `Generating Ollama response using model ${model} for prompt: "${prompt.substring(0, 50)}..."`);
            
            const response = await axios.post(url, {
                model,
                prompt,
                temperature,
                max_tokens: maxTokens,
                stream: false
            });
            
            const responseText = response.data.response || '';
            logger.debug('AIService', `Received Ollama response: "${responseText.substring(0, 50)}..."`);
            
            return responseText;
        } catch (error) {
            logger.error('AIService', `Error generating Ollama response: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Provides code completion for the given code
     * @param {string} code - The code to complete
     * @param {Object} options - Additional options for the request
     * @returns {Promise<string>} The completed code
     */
    async completeCode(code, options = {}) {
        // Create a specialized prompt for code completion
        const prompt = `Complete the following code:\n\n${code}\n\nProvide only the completed code without explanations.`;
        
        // Use a lower temperature for more deterministic results
        const completionOptions = {
            ...options,
            temperature: options.temperature || 0.3
        };
        
        return this.generateResponse(prompt, completionOptions);
    }
    
    /**
     * Explains the given code
     * @param {string} code - The code to explain
     * @param {Object} options - Additional options for the request
     * @returns {Promise<string>} The explanation
     */
    async explainCode(code, options = {}) {
        const prompt = `Explain the following code in simple terms:\n\n${code}`;
        return this.generateResponse(prompt, options);
    }
}

module.exports = AIService; 