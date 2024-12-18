document.getElementById('settingsForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const apiKey = document.getElementById('apiKey').value.trim();
    const fileInput = document.getElementById('solutionImage');
    const file = fileInput.files[0];

    let base64Image = null;
    if (file) {
        base64Image = await readFileAsBase64(file);
    }

    // Store the API key and base64 image in storage
    chrome.storage.local.set({
        apiKey: apiKey,
        localBase64Image: base64Image
    }, function() {
        console.log('Settings saved.');
        // Optionally, let the user know settings were saved:
        alert('Settings saved!');
    });
});

function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => {
            reader.abort();
            reject(new Error('Problem reading the file.'));
        };
        reader.onloadend = () => {
            // Result is a data URL, so split to get the base64 only
            const base64Data = reader.result.split(',')[1];
            resolve(base64Data);
        };
        reader.readAsDataURL(file);
    });
}
