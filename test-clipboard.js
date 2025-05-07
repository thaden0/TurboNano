const clipboardy = require('clipboardy');

async function testClipboard() {
    try {
        // Test writing to clipboard
        const testText = 'Test text for clipboard ' + new Date().toISOString();
        console.log('Writing to clipboard:', testText);
        await clipboardy.write(testText);
        
        // Test reading from clipboard
        const clipboardContent = await clipboardy.read();
        console.log('Read from clipboard:', clipboardContent);
        
        // Verify content matches
        if (clipboardContent === testText) {
            console.log('✅ SUCCESS: Clipboard test passed!');
        } else {
            console.error('❌ FAILURE: Clipboard test failed - content does not match');
            console.log('Expected:', testText);
            console.log('Got:', clipboardContent);
        }
    } catch (error) {
        console.error('Error testing clipboard:', error.message);
    }
}

// Run the test
testClipboard(); 