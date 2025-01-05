// contentScript.js

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'grabRubric') {
        // Existing rubric grabbing logic
        grabRubric(sendResponse);
        return true; // Keeps the message channel open for sendResponse
    } else if (request.action === 'grabImages') {
        // Existing image grabbing logic
        grabAllImages().then((imageUrls) => {
            sendResponse({ success: true, imageUrls });
        }).catch((error) => {
            sendResponse({ success: false, error: error.message });
        });
        return true; // Indicates that the response will be sent asynchronously
    } else if (request.action === 'grabQuestionNumber') {
        // New action to grab the question number
        const questionNumber = grabQuestionNumber();
        sendResponse({ questionNumber });
        return true;
    }
});

/**
 * Function to grab the rubric from the page.
 * @param {Function} sendResponse - The response callback.
 */
function grabRubric(sendResponse) {
    const submissionGraderDiv = document.querySelector('div[data-react-class="SubmissionGrader"]');
    let rubricText = [];

    if (submissionGraderDiv) {
        const dataString = submissionGraderDiv.getAttribute('data-react-props');
        let data;
        try {
            data = JSON.parse(dataString);
        } catch (e) {
            console.error('Failed to parse data-react-props:', e);
            sendResponse({ rubric: '' });
            return;
        }

        const itemGroups = data.rubric_item_groups || [];
        const items = data.rubric_items || [];

        const topLevelItems = items.filter(i => i.group_id === null);
        const groupedItems = items.filter(i => i.group_id !== null);

        const topLevelEntries = [];

        topLevelItems.forEach(i => {
            topLevelEntries.push({
                type: 'item',
                position: i.position,
                description: i.description,
                weight: i.weight
            });
        });

        itemGroups.forEach(g => {
            topLevelEntries.push({
                type: 'group',
                position: g.position,
                id: g.id,
                description: g.description,
                mutually_exclusive: g.mutually_exclusive,
            });
        });

        topLevelEntries.sort((a, b) => a.position - b.position);

        const itemsByGroupId = new Map();
        groupedItems.forEach(i => {
            if (!itemsByGroupId.has(i.group_id)) {
                itemsByGroupId.set(i.group_id, []);
            }
            itemsByGroupId.get(i.group_id).push(i);
        });

        for (const [gid, arr] of itemsByGroupId.entries()) {
            arr.sort((a, b) => a.position - b.position);
        }

        topLevelEntries.forEach(entry => {
            if (entry.type === 'item') {
                rubricText.push(`Item: ${entry.description} (Deduct ${entry.weight} points)`);
            } else {
                rubricText.push(`Group ${entry.position}: ${entry.description}`);
                const subItems = itemsByGroupId.get(entry.id) || [];
                subItems.forEach((si, idx) => {
                    rubricText.push(`  Subitem ${idx + 1}: ${si.description} (Deduct ${si.weight} points)`);
                });
            }
        });
    }

    // Combine the rubric text array into a single string
    const finalRubric = rubricText.join('\n');

    // Send the rubric back to the popup
    sendResponse({ rubric: finalRubric });
}

/**
 * Function to grab all student answer images across multiple pages.
 * @returns {Promise<Array>} - A promise that resolves to an array of image URLs.
 */
async function grabAllImages() {
    let imageUrls = [];
    let hasNextPage = true;

    while (hasNextPage) {
        // Collect images on the current page
        const images = document.querySelectorAll('.pv--viewport img');
        images.forEach(img => {
            if (img.src) {
                imageUrls.push(img.src);
            }
        });

        // Check if the "next page" button is enabled
        const nextPageButton = document.querySelector('button.pageViewerControls--arrow-next');
        if (nextPageButton && !nextPageButton.disabled) {
            // Click the "next page" button
            nextPageButton.click();

            // Wait for the page to load; adjust the delay as necessary
            await waitForPageLoad();

            // Optional: Additional checks can be implemented here
        } else {
            hasNextPage = false; // No more pages to process
        }
    }

    return imageUrls;
}

/**
 * Function to grab the question number from the page.
 * @returns {string} - The extracted question number or an empty string if not found.
 */
function grabQuestionNumber() {
    const questionElement = document.querySelector('.submissionGrader--questionSwitcherHeading span span');
    let questionNumber = '';
    if (questionElement) {
        const fullText = questionElement.textContent.trim();
        const splitText = fullText.split("Select to navigate to a different question from this student's submission.");
        questionNumber = splitText[0].trim();
    }
    return questionNumber;
}


/**
 * Helper function to wait for the page to load after clicking the next button.
 * @returns {Promise} - Resolves after a specified delay.
 */
function waitForPageLoad() {
    return new Promise(resolve => {
        // Adjust the delay based on the expected page load time
        setTimeout(() => {
            resolve();
        }, 500); // 2 seconds delay
    });
}
