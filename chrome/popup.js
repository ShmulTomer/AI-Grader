// popup.js

document.addEventListener('DOMContentLoaded', () => {
    const profileSelect = document.getElementById('profileSelect');
    const createProfileBtn = document.getElementById('createProfileBtn');
    const grabRubricBtn = document.getElementById('grabRubricBtn');
    const rubricDisplay = document.getElementById('rubricDisplay');
    const runBtn = document.getElementById('runBtn');
    const statusDiv = document.getElementById('status');
    const apiKeyInput = document.getElementById('apiKey');
    const defaultInstructionsInput = document.getElementById('defaultInstructions');
    const solutionInput = document.getElementById('solutionInput');
    const extraInstructionsInput = document.getElementById('extraInstructions');


    let currentTabId = null;

    // Get the current active tab ID
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length > 0) {
            currentTabId = tabs[0].id;
            loadProfiles(); // Now that we have the tab ID, load profiles
        }
    });

    // Function to load profiles from storage and populate the dropdown
    function loadProfiles(callback) {
        chrome.storage.local.get(['questionProfiles'], (result) => {
            const profiles = result.questionProfiles || {};
    
            // Clear existing options except the first
            while (profileSelect.options.length > 1) {
                profileSelect.remove(1);
            }
            for (const profileName in profiles) {
                const option = document.createElement('option');
                option.value = profileName;
                option.textContent = profileName;
                profileSelect.appendChild(option);
            }
    
            // After populating profiles, fetch the selected profile for this tab
            if (currentTabId !== null) {
                chrome.runtime.sendMessage(
                    { action: 'getSelectedProfile', tabId: currentTabId },
                    (response) => {
                        const selectedProfile = response.selectedProfile;
                        if (selectedProfile && profiles[selectedProfile]) {
                            profileSelect.value = selectedProfile;
                            loadProfileData(selectedProfile);
                        }
                        if (callback) callback();
                    }
                );
            } else {
                if (callback) callback();
            }
        });
    }
    
    // Function to load a specific profile's data into the fields
    function loadProfileData(profileName) {
        chrome.storage.local.get(['questionProfiles'], (result) => {
            const profiles = result.questionProfiles || {};
            const profile = profiles[profileName];
            if (profile) {
                solutionInput.value = profile.solution || '';
                rubricDisplay.value = profile.rubric || '';
                extraInstructionsInput.value = profile.extraInstructions || '';
            }
        });
    }

    /**
     * Function to get the question number from the content script.
     * @returns {Promise<string>} - A promise that resolves to the question number.
     */
    function getQuestionNumber() {
        return new Promise((resolve, reject) => {
            if (currentTabId === null) {
                resolve('');
                return;
            }
            chrome.tabs.sendMessage(currentTabId, { action: 'grabQuestionNumber' }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error('Error grabbing question number:', chrome.runtime.lastError.message);
                    resolve('');
                    return;
                }
                if (response && response.questionNumber) {
                    resolve(response.questionNumber);
                } else {
                    resolve('');
                }
            });
        });
    }

    // Handle Create New Profile
    createProfileBtn.addEventListener('click', () => {
        const profileName = prompt('Enter new profile name:');
        if (profileName) {
            chrome.storage.local.get(['questionProfiles'], (result) => {
                const profiles = result.questionProfiles || {};
                if (profiles[profileName]) {
                    alert('Profile already exists.');
                } else {
                    profiles[profileName] = {
                        solution: '',
                        rubric: '',
                        extraInstructions: ''
                    };
                    chrome.storage.local.set({ questionProfiles: profiles }, () => {
                        const option = document.createElement('option');
                        option.value = profileName;
                        option.textContent = profileName;
                        profileSelect.appendChild(option);
                        profileSelect.value = profileName;
                        chrome.storage.local.set({ lastSelectedProfile: profileName }, () => {
                            alert('Profile created. Please fill in the details.');
                        });
                    });
                }
            });
        }
    });

    // Handle Profile Selection
    profileSelect.addEventListener('change', () => {
        const selectedProfile = profileSelect.value;
        if (selectedProfile) {
            // Save the selected profile for the current tab
            if (currentTabId !== null) {
                chrome.runtime.sendMessage(
                    { action: 'setSelectedProfile', tabId: currentTabId, profileName: selectedProfile },
                    (response) => {
                        if (response.success) {
                            console.log(`Selected profile for tab ${currentTabId} set to "${selectedProfile}".`);
                        }
                    }
                );
            }
            loadProfileData(selectedProfile);
        }
    });
        // Handle Rubric Grabbing
    grabRubricBtn.addEventListener('click', () => {
        // Send a message to the content script to extract the rubric
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length === 0) {
                alert('No active tab found.');
                return;
            }
            chrome.tabs.sendMessage(tabs[0].id, { action: 'grabRubric' }, (response) => {
                if (chrome.runtime.lastError) {
                    alert('Cannot grab rubric from this page.');
                    console.error(chrome.runtime.lastError.message);
                    return;
                }
                if (response && response.rubric) {
                    rubricDisplay.value = response.rubric;
                } else {
                    alert('Failed to grab rubric from the page.');
                }
            });
        });
    });

    // Save changes when inputs lose focus
    solutionInput.addEventListener('blur', saveProfileData);
    rubricDisplay.addEventListener('blur', saveProfileData);
    extraInstructionsInput.addEventListener('blur', saveProfileData);
    apiKeyInput.addEventListener('blur', saveGlobalData);
    defaultInstructionsInput.addEventListener('blur', saveGlobalData);

    // Function to save profile data
    function saveProfileData() {
        const selectedProfile = profileSelect.value;
        if (!selectedProfile) return;

        const solution = solutionInput.value;
        const rubric = rubricDisplay.value;
        const extraInstructions = extraInstructionsInput.value;

        chrome.storage.local.get(['questionProfiles'], (result) => {
            const profiles = result.questionProfiles || {};
            if (profiles[selectedProfile]) {
                profiles[selectedProfile] = {
                    solution,
                    rubric,
                    extraInstructions
                };
                chrome.storage.local.set({ questionProfiles: profiles }, () => {
                    console.log(`Profile "${selectedProfile}" updated.`);
                });
            }
        });
    }

    // Function to save global data (API Key and Default Instructions)
    function saveGlobalData() {
        const apiKey = apiKeyInput.value;
        const defaultInstructions = defaultInstructionsInput.value;

        chrome.storage.local.set({
            apiKey,
            defaultInstructions
        }, () => {
            console.log('Global settings updated.');
        });
    }

    // Load global data on popup load
    function loadGlobalData() {
        chrome.storage.local.get(['apiKey', 'defaultInstructions'], (result) => {
            apiKeyInput.value = result.apiKey || '';
            defaultInstructionsInput.value = result.defaultInstructions || '';
        });
    }

    // Initialize global data on load
    loadGlobalData();

    /**
     * Function to transcribe multiple images using OpenAI API.
     * @param {Array<string>} base64Images - An array of Base64-encoded image strings.
     * @param {string} apiKey - The OpenAI API key.
     * @param {string} questionNumber - The question number (optional).
     * @returns {Promise<string>} - The transcription result as a single text blob.
     */
    async function transcribeImages(base64Images, apiKey, questionNumber) {
        // Construct the prompt
        let prompt = `Transcribe the answer to question ${questionNumber}, using LaTeX format only when necessary for equations. Only give the transcription, no other text.`;
        if (!questionNumber) {
            prompt = `Transcribe these images, using LaTeX format only when necessary for equations. Only give the transcription, no other text.`;
        }

        // Send the API request
        const apiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "gpt-4o-mini", // Ensure you're using the correct model that supports your requirements
                messages: [
                    {
                        role: "user",
                        content: [
                            {
                                type: "text",
                                text: prompt,
                            },
                            ...base64Images.map(base64Image => ({
                                type: "image_url",
                                image_url: {
                                    url: `data:image/jpeg;base64,${base64Image}`
                                }
                            }))
                        ]
                    }
                ],
                temperature: 0.3, // Adjust for desired creativity
            })
        });

        if (!apiResponse.ok) {
            const errorData = await apiResponse.json();
            throw new Error(`OpenAI API Error: ${errorData.error.message}`);
        }

        const result = await apiResponse.json();
        if (result.choices && result.choices.length > 0) {
            const transcription = result.choices[0].message.content.trim();
            return transcription;
        } else {
            throw new Error('No transcription result from OpenAI API.');
        }
    }

    /**
     * Function to grade the transcription using OpenAI's GPT-4.
     * @param {string} transcription - The transcribed student's solution.
     * @param {string} rubric - The grading rubric.
     * @param {string} defaultInstructions - Default grading instructions.
     * @param {string} questionSpecificInstructions - Question-specific grading instructions.
     * @param {string} apiKey - OpenAI API key.
     * @returns {Promise<Object>} - The grading result.
     */
    async function gradeTranscription(transcription, rubric, defaultInstructions, questionSpecificInstructions, apiKey) {
        // Construct the prompt
        let prompt = `You are an accurate and fair grader.\n\n` +
                    `Student's Solution:\n${transcription}\n\n` +
                    `Rubric:\n${rubric}\n\n` +
                    `Grading Instructions:\n${defaultInstructions}\n${questionSpecificInstructions}\n\n` +
                    `Please provide the grading feedback in the following JSON format (make sure to use newlines to separate rubric items):\n` +
                    `{ "rubric_deductions": <string>, "feedback": "<string>" }`;

        // Send the API request
        const apiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "gpt-4o", // Ensure you're using the correct model that supports your requirements
                messages: [
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: 0.7, // Adjust for desired creativity
            })
        });

        if (!apiResponse.ok) {
            const errorData = await apiResponse.json();
            throw new Error(`OpenAI API Error: ${errorData.error.message}`);
        }

        const result = await apiResponse.json();
        if (result.choices && result.choices.length > 0) {
            const gradingJson = result.choices[0].message.content.trim();
            try {
                const gradingResult = JSON.parse(gradingJson);
                return gradingResult;
            } catch (error) {
                throw new Error('Failed to parse grading result. Ensure the response is in valid JSON format.');
            }
        } else {
            throw new Error('No grading result from OpenAI API.');
        }
    }

    /**
     * Function to display the grading result in the popup UI.
     * @param {Object} gradingResult - The grading result containing grade and feedback.
     */
    function displayGradingResult(gradingResult) {
        // Create a container for the grading result
        const gradingContainer = document.createElement('div');
        gradingContainer.id = 'gradingResult';
        gradingContainer.style.marginTop = '20px';
        gradingContainer.style.padding = '10px';
        gradingContainer.style.border = '1px solid #cccccc';
        gradingContainer.style.borderRadius = '5px';
        gradingContainer.style.backgroundColor = '#f9f9f9';

        // Grade Display
        const gradeElement = document.createElement('p');
        gradeElement.innerHTML = `<strong>Rubric:<br></strong> ${gradingResult.rubric_deductions.replace(/\n/g, '<br>')}`;
        gradingContainer.appendChild(gradeElement);

        // Feedback Display
        const feedbackElement = document.createElement('p');
        feedbackElement.innerHTML = `<br><strong>Feedback:<br></strong> ${gradingResult.feedback.replace(/\n/g, '<br>')}`;
        gradingContainer.appendChild(feedbackElement);

        // Append the grading result to the container
        const container = document.querySelector('.container');
        const existingGrading = document.getElementById('gradingResult');
        if (existingGrading) {
            existingGrading.remove(); // Remove previous grading result if exists
        }
        container.appendChild(gradingContainer);
    }

    
    // Handle Run Button Click
    runBtn.addEventListener('click', async () => {
        const selectedProfile = profileSelect.value;
        const solution = solutionInput.value.trim();
        const rubric = rubricDisplay.value.trim();
        const extraInstructions = extraInstructionsInput.value.trim();
        const apiKey = apiKeyInput.value.trim();
        const defaultInstructions = defaultInstructionsInput.value.trim();

        if (!selectedProfile) {
            alert('Please select or create a question profile.');
            return;
        }

        if (!solution) {
            alert('Please enter the solution.');
            return;
        }

        if (!rubric) {
            alert('Please grab or enter the rubric.');
            return;
        }

        if (!apiKey) {
            alert('Please enter your OpenAI API Key.');
            return;
        }

        // Display status
        statusDiv.style.display = 'block';
        statusDiv.textContent = 'Running...';

        // Log the data to the console
        console.log('--- Grading Run ---');
        console.log('Selected Profile:', selectedProfile);
        console.log('Solution:', solution);
        console.log('Rubric:', rubric);
        console.log('Extra Grading Instructions:', extraInstructions);
        console.log('OpenAI API Key:', apiKey);
        console.log('Default Grading Instructions:', defaultInstructions);
        console.log('--------------------');

        try {
            // Get the question number
            const questionNumber = await getQuestionNumber();
            console.log('Question Number:', questionNumber);

            // Send message to content script to grab images
            if (currentTabId !== null) {
                const grabImagesResponse = await new Promise((resolve, reject) => {
                    chrome.tabs.sendMessage(currentTabId, { action: 'grabImages' }, (response) => {
                        if (chrome.runtime.lastError) {
                            console.error('Error sending message:', chrome.runtime.lastError.message);
                            resolve({ success: false, error: chrome.runtime.lastError.message });
                            return;
                        }

                        if (response && response.success) {
                            resolve({ success: true, imageUrls: response.imageUrls });
                        } else {
                            resolve({ success: false, error: response.error });
                        }
                    });
                });

                if (!grabImagesResponse.success) {
                    console.error('Failed to grab images:', grabImagesResponse.error);
                    statusDiv.textContent = 'Failed to grab images.';
                    return;
                }

                const imageUrls = grabImagesResponse.imageUrls;
                console.log('Image URLs:', imageUrls);

                if (imageUrls.length === 0) {
                    console.log('No images found to transcribe.');
                    statusDiv.textContent = 'No images found to transcribe.';
                    return;
                }

                // Fetch all images as Base64
                const base64Images = await Promise.all(imageUrls.map(async (imageUrl) => {
                    try {
                        const fetchImageResponse = await new Promise((resolve, reject) => {
                            chrome.runtime.sendMessage({ action: 'fetchImage', url: imageUrl }, (response) => {
                                if (chrome.runtime.lastError) {
                                    console.error('Error fetching image:', chrome.runtime.lastError.message);
                                    resolve({ success: false, error: chrome.runtime.lastError.message });
                                    return;
                                }

                                if (response && response.base64Image) {
                                    resolve({ success: true, base64Image: response.base64Image });
                                } else {
                                    resolve({ success: false, error: response.error });
                                }
                            });
                        });

                        if (!fetchImageResponse.success) {
                            console.error('Failed to fetch image:', fetchImageResponse.error);
                            return null; // Skip this image
                        }

                        return fetchImageResponse.base64Image;
                    } catch (error) {
                        console.error('Error processing image:', error);
                        return null; // Skip this image
                    }
                }));

                // Filter out any failed image fetches
                const validBase64Images = base64Images.filter(base64 => base64 !== null);

                if (validBase64Images.length === 0) {
                    console.log('No valid images to transcribe.');
                    statusDiv.textContent = 'No valid images to transcribe.';
                    return;
                }

                // Transcribe all images in a single API call
                const transcription = await transcribeImages(validBase64Images, apiKey, questionNumber);
                console.log('Transcription:', transcription);

                // Log the transcription with its corresponding image URLs (optional)
                console.log('--- Complete Transcription ---');
                console.log(transcription);
                console.log('------------------------------');

                // Grade the transcription
                const gradingResult = await gradeTranscription(
                    transcription,
                    rubric,
                    defaultInstructions,
                    extraInstructions,
                    apiKey
                );
                console.log('Grading Result:', gradingResult);

                // Display the grade and feedback
                displayGradingResult(gradingResult);

                // Update status
                statusDiv.textContent = `Run completed. Grading result displayed below.`;
            } else {
                statusDiv.textContent = 'No active tab found.';
            }
        } catch (error) {
            console.error('Run Grading Error:', error);
            statusDiv.textContent = 'An error occurred during grading.';
        }
        console.log("Run completed!")
    });
});
