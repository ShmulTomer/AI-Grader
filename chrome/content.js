console.log("START RUN");

// Listen for messages from hello.html (popup or background)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Message received in content script:", request);

    if (request.action === "runGrading") {
        console.log("Running grading process...");
        runGrading();
    }
});

async function runGrading() {
    console.log("Content script running grading process...");


    let apiKey = '';
    let extraInstructions = '';
    let solutionImage = '';

    // Wait for storage retrieval
    const storedData = await new Promise((resolve) => {
        chrome.storage.sync.get(['openaiApiKey', 'extraInstructions', 'solutionImage'], (data) => {
            resolve(data);
        });
    });

    apiKey = storedData.openaiApiKey;
    extraInstructions = storedData.extraInstructions || '';
    solutionImage = storedData.solutionImage; // Must match key used when saving image data

    if (!apiKey) {
        console.error('No OpenAI API key found. Please set one in the popup.');
        return;
    }

    let questionNumber = '';
    const questionElement = document.querySelector('.submissionGrader--questionSwitcherHeading span span');
    if (questionElement) {
        questionNumber = questionElement.textContent.trim().split("Select to navigate to a different question from this student's submission.")[0];
    }

    const submissionGraderDiv = document.querySelector('div[data-react-class="SubmissionGrader"]');
    let rubricText = [];
    if (submissionGraderDiv) {
        const dataString = submissionGraderDiv.getAttribute('data-react-props');
        const data = JSON.parse(dataString);

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

    const answerTranscriptionPromise = new Promise((resolve) => {
        setTimeout(async function() {
            const imageElement = document.querySelector('.pv--viewport img');
            if (imageElement) {
                const imageUrl = imageElement.src;
                console.log('Image URL in content script:', imageUrl);

                chrome.runtime.sendMessage({action: "fetchImage", url: imageUrl}, async (response) => {
                    if (response && response.base64Image) {
                        const base64Image = response.base64Image;
                        const answerTranscription = await transcribeImage(base64Image, apiKey, questionNumber);
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


    const solutionTranscriptionPromise = new Promise(async (resolve) => {
        if (solutionImage) {
            const solutionTranscription = await transcribeImage(solutionImage, apiKey, questionNumber);
            resolve(solutionTranscription);
        } else {
            console.error('No solution image found in storage');
            resolve("");
        }
    });

    const [answerTranscription, solutionTranscription] = await Promise.all([answerTranscriptionPromise, solutionTranscriptionPromise]);

    console.log("Answer Transcription:", answerTranscription);
    console.log("Solution Transcription:", solutionTranscription);

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
    Response should strictly in the format:
    "Select rubric items:
    <item 1>
    <item 2>
    ...

    Comments:
    <comment 1>

    Extra Instructions:
    ${extraInstructions}
    `;

    const gradingResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
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

    // Send results back to hello.html
    chrome.runtime.sendMessage({
        action: 'gradingComplete',
        results: finalGradeAndComments
    });
}

async function transcribeImage(base64Image, apiKey, questionNumber) {
    let prompt = `Transcribe the answer to question ${questionNumber}, using LaTeX format only when necessary for equations. Only give the transcription, no other text.`;
    if (!questionNumber) {
        prompt = `Transcribe this image, using LaTeX format only when necessary for equations. Only give the transcription, no other text.`;
    }
    const apiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
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
