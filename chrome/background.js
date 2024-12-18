chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "fetchImage") {
      fetch(request.url)
        .then(response => {
          if (!response.ok) {
            throw new Error(`Network response was not ok: ${response.statusText}`);
          }
          return response.blob();
        })
        .then(blob => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64Image = reader.result.split(',')[1];
            sendResponse({base64Image});
          };
          reader.readAsDataURL(blob);
        })
        .catch(error => {
          console.error('Error fetching image:', error);
          sendResponse({});
        });
      return true; // keep the message channel open for async response
    }
  });
  