// background.js

// Object to store selected profiles per tab
const tabProfiles = {};

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    const tabId = sender.tab.id;

    if (request.action === 'getSelectedProfile') {
        const tabId = request.tabId;
        sendResponse({ selectedProfile: tabProfiles[tabId] || '' });
    }
    else if (request.action === 'setSelectedProfile') {
        const tabId = request.tabId;
        const profileName = request.profileName;
        tabProfiles[tabId] = profileName;
        sendResponse({ success: true });
    }
    // Add more actions here if needed
    return true; // Keeps the message channel open for sendResponse
});

// Clean up tabProfiles when a tab is removed
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
    if (tabProfiles.hasOwnProperty(tabId)) {
        delete tabProfiles[tabId];
    }
});

// Listen for image fetch requests
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'fetchImage') {
        const imageUrl = request.url;
        fetchImageAsBase64(imageUrl).then((base64Image) => {
            sendResponse({ base64Image });
        }).catch((error) => {
            sendResponse({ error: error.message });
        });
        return true; // Keeps the message channel open for sendResponse
    }
});


/**
 * Fetches an image from the given URL and converts it to a Base64 string.
 * @param {string} url - The URL of the image to fetch.
 * @returns {Promise<string>} - A promise that resolves to the Base64 string of the image.
 */
async function fetchImageAsBase64(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
    }
    const blob = await response.blob();
    return await convertBlobToBase64(blob);
}

/**
 * Converts a Blob object to a Base64 string.
 * @param {Blob} blob - The Blob object to convert.
 * @returns {Promise<string>} - A promise that resolves to the Base64 string.
 */
function convertBlobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => {
            reader.abort();
            reject(new Error('Failed to read blob as Base64'));
        };
        reader.onload = () => {
            const dataUrl = reader.result;
            // Extract Base64 string from Data URL
            const base64 = dataUrl.split(',')[1];
            resolve(base64);
        };
        reader.readAsDataURL(blob);
    });
}


