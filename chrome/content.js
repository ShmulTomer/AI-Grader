console.log("START RUN");

window.onload = function() {
    // TODO: Have this only run when the toggle is on in the hello.html page
    console.log("Content script loaded");

    // Get the question number from the page
    let questionNumber = document.querySelector('.submissionGrader--questionSwitcherHeading span span').textContent.trim();
    questionNumber = questionNumber.split("Select to navigate to a different question from this student's submission.")[0];

    // Select the SubmissionGrader div
    const submissionGraderDiv = document.querySelector('div[data-react-class="SubmissionGrader"]');

    let rubricText = [];
    if (submissionGraderDiv) {
        // Parse the JSON data from the data-react-props attribute
        const dataString = submissionGraderDiv.getAttribute('data-react-props');
        const data = JSON.parse(dataString);

        const itemGroups = data.rubric_item_groups || [];
        const items = data.rubric_items || [];

        // Separate top-level items (no group_id) from grouped items
        const topLevelItems = items.filter(i => i.group_id === null);
        const groupedItems = items.filter(i => i.group_id !== null);

        // Build an array of top-level entries (both items and groups)
        const topLevelEntries = [];

        // Add top-level items
        topLevelItems.forEach(i => {
            topLevelEntries.push({
                type: 'item',
                position: i.position,
                description: i.description,
                weight: i.weight
            });
        });

        // Add groups
        itemGroups.forEach(g => {
            topLevelEntries.push({
                type: 'group',
                position: g.position,
                id: g.id,
                description: g.description,
                mutually_exclusive: g.mutually_exclusive,
            });
        });

        // Sort top-level entries by their position to preserve original order
        topLevelEntries.sort((a, b) => a.position - b.position);

        // For each group, we'll need to find its subitems and sort them by position
        const itemsByGroupId = new Map();
        groupedItems.forEach(i => {
            if (!itemsByGroupId.has(i.group_id)) {
                itemsByGroupId.set(i.group_id, []);
            }
            itemsByGroupId.get(i.group_id).push(i);
        });

        // Sort each group's items by position
        for (const [gid, arr] of itemsByGroupId.entries()) {
            arr.sort((a, b) => a.position - b.position);
        }

        // Build the rubric text in the correct order
        topLevelEntries.forEach(entry => {
            if (entry.type === 'item') {
                // Just a top-level standalone item
                rubricText.push(`Item: ${entry.description} (Deduct ${entry.weight} points)`);
            } else {
                // A group
                rubricText.push(`Group ${entry.position}: ${entry.description}`);
                const subItems = itemsByGroupId.get(entry.id) || [];
                subItems.forEach((si, idx) => {
                    rubricText.push(`  Subitem ${idx + 1}: ${si.description} (Deduct ${si.weight} points)`);
                });
            }
        });
    } else {
        console.log('No SubmissionGrader element found.');
    }

    const answerTranscriptionPromise = new Promise((resolve) => {
        setTimeout(async function() {
            // Select the image element for student's answer
            const imageElement = document.querySelector('.pv--viewport img');
            if (imageElement) {
                const imageUrl = imageElement.src;
                console.log('Image URL in content script:', imageUrl);

                // Send a message to background script to fetch the image
                chrome.runtime.sendMessage({action: "fetchImage", url: imageUrl}, async (response) => {
                    if (response && response.base64Image) {
                        const base64Image = response.base64Image;
                        const answerTranscription = await transcribeImage(base64Image, questionNumber);
                        resolve(answerTranscription);
                    } else {
                        console.error('No response or no base64 image returned from background');
                        resolve("");
                    }
                });
            } else {
                console.log('Image element not found');
                resolve("");
            }
        }, 1000);
    });

    const localImageUrl = chrome.runtime.getURL('solution.png');
    console.log('Local image URL:', localImageUrl);

    const solutionTranscriptionPromise = new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: "fetchImage", url: localImageUrl }, async (response) => {
            if (response && response.base64Image) {
                const base64Image = response.base64Image;
                const solutionTranscription = await transcribeImage(base64Image, questionNumber);
                resolve(solutionTranscription);
            } else {
                console.error('No response or no base64 image returned from background for local image');
                resolve("");
            }
        });
    });

    // After both transcriptions are done, call the grading API
    Promise.all([answerTranscriptionPromise, solutionTranscriptionPromise])
        .then(async ([answerTranscription, solutionTranscription]) => {
            console.log("Answer Transcription:", answerTranscription);
            console.log("Solution Transcription:", solutionTranscription);

            // Construct the grading prompt
            const rubricString = rubricText.join('\n');
            console.log("Rubric String:", rubricString);
            const gradingPrompt = `
Your role is to be an accurate and fair grader for an Automata & Complexity Theory computer science college course.

Given:
Question/solution: ${solutionTranscription}
Student's answer: ${answerTranscription}

The rubric is as follows:
${rubricString}

Provide which rubric items you would select (i.e. dock points for) and comments on errors, if any. Do not hesitate to dock points. For the comments, be as specific as possible and stay ***VERY*** brief, talking in POV to the student. Only comment on the error, and nothing else (MAX 2 sentences).
            `;

            // Call the OpenAI API to get the final grade and comment
            const gradingResponse = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer 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`
                },
                body: JSON.stringify({
                    model: "gpt-4o-mini", 
                    messages: [
                        {
                            role: "user",
                            content: gradingPrompt
                        }
                    ],
                    temperature: 0.7
                })
            });

            const gradingResult = await gradingResponse.json();
            const finalGradeAndComments = gradingResult.choices[0].message.content;
            console.log("Final Grade and Comments:", finalGradeAndComments);

            // Here you have the final grade and comments. You could display them in the UI, send them elsewhere, etc.
        });
};



async function transcribeImage(base64Image, questionNumber) {
    let prompt = `Transcribe the answer to question ${questionNumber}, using LaTeX format only when necessary for equations. Only give the transcription, no other text.`;
    if (!questionNumber) {
        prompt = `Transcribe this image, using LaTeX format only when necessary for equations. Only give the transcription, no other text.`;
    }
    const apiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer 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` // Replace with your actual API key
        },
        body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: prompt,
                        },
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:image/jpeg;base64,${base64Image}`
                            }
                        }
                    ]
                }
            ]
        })
    });
    const result = await apiResponse.json();
    return result.choices[0].message.content;
}


console.log("END RUN3");