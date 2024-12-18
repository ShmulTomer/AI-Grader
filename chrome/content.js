console.log("START RUN");

// window.onload = function() {
//     console.log("Script started");

//     setTimeout(function() {
//         const headingElement = document.querySelector('.submissionGrader--questionSwitcherHeading span span');
//         if (headingElement) {
//             const text = headingElement.textContent.trim();
//             console.log('Heading text:', text);
//         } else {
//             console.log('Heading element not found');
//             // Log the entire document or a section to debug
//             console.log(document.body.innerHTML);
//         }
//     }, 1000);
// };

window.onload = function() {
    console.log("Content script loaded");

    let questionNumber = document.querySelector('.submissionGrader--questionSwitcherHeading span span').textContent.trim();
    questionNumber = questionNumber.split("Select to navigate to a different question from this student's submission.")[0];
    
    setTimeout(async function() {
        // Select the image element
        const imageElement = document.querySelector('.pv--viewport img');
        if (imageElement) {
            const imageUrl = imageElement.src;
            console.log('Image URL in content script:', imageUrl);

            // Send a message to background script to fetch the image
            chrome.runtime.sendMessage({action: "fetchImage", url: imageUrl}, async (response) => {
                if (response && response.base64Image) {
                    const base64Image = response.base64Image;
                    // console.log('Base64 image:', base64Image);
                    // Now call the ChatGPT API with the base64 image
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
                                            text: `Transcribe the answer to question ${questionNumber}, using LaTeX format only when necessary for equations. Only give the transcription, no other text.`
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
                    console.log('Transcription:', result.choices[0].message.content);
                } else {
                    console.error('No response or no base64 image returned from background');
                }
            });
        } else {
            console.log('Image element not found');
        }
    }, 1000);
};




console.log("END RUN3");