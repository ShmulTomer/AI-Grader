document.addEventListener('DOMContentLoaded', () => {
    const apiKeyInput = document.getElementById('apiKey');
    const instructionsInput = document.getElementById('instructions');
    const solutionImageInput = document.getElementById('solutionImage');
    const imagePreview = document.getElementById('imagePreview');
    const saveKeyButton = document.getElementById('saveKeyButton');
    const runButton = document.getElementById('runButton');
    const loadingCircle = document.getElementById('loadingCircle');
    const resultsDiv = document.getElementById('results');

    // Load previously saved data
    chrome.storage.sync.get(['openaiApiKey', 'extraInstructions', 'solutionImageData'], (data) => {
        if (data.openaiApiKey) {
            apiKeyInput.value = data.openaiApiKey;
        }
        if (data.extraInstructions) {
            instructionsInput.value = data.extraInstructions;
        }
        if (data.solutionImageData) {
            imagePreview.src = data.solutionImageData;
            imagePreview.style.display = 'block';
        }
    });

    // Save the API key and other fields when "Save Key" is clicked
    saveKeyButton.addEventListener('click', () => {
        const key = apiKeyInput.value.trim();
        const instructions = instructionsInput.value.trim();

        const dataToSave = {
            openaiApiKey: key || '',
            extraInstructions: instructions || ''
        };

        chrome.storage.sync.set(dataToSave, () => {
            resultsDiv.textContent = 'Data saved successfully!';
        });
    });

    // Handle image uploads
    solutionImageInput.addEventListener('change', () => {
        const file = solutionImageInput.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
            const imageData = reader.result;
            // Save the image data to storage
            chrome.storage.sync.set({solutionImageData: imageData}, () => {
                imagePreview.src = imageData;
                imagePreview.style.display = 'block';
                resultsDiv.textContent = 'Solution image saved successfully!';
            });
        };
        reader.readAsDataURL(file);
    });

    // When Run is clicked
    runButton.addEventListener('click', async () => {
        loadingCircle.style.display = 'block';
        resultsDiv.textContent = '';

        // Send a message to the content script to start grading
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            const activeTab = tabs[0];
            console.log("Sending message to content script");
            console.log(activeTab.id);
            chrome.tabs.sendMessage(activeTab.id, {action: "runGrading"});
            console.log("Message sent to content script");
        });
    });

    // Listen for messages from the content script with the grading results
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'gradingComplete') {
            loadingCircle.style.display = 'none';
            resultsDiv.textContent = request.results;
        }
    });
});
