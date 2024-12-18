# Given an image with a question, transcribe it to text by asking ChatGPT to do so


# Set your API key
from openai import OpenAI
import base64

client = OpenAI()
client.api_key = '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'  # Replace with your actual API key




def transcribe_image(image_path: str) -> str:
    """
    Transcribe text from an image and convert it into LaTeX format using OpenAI's GPT-4o-mini.

    Args:
        image_path (str): Path to the image file to transcribe.

    Returns:
        str: Transcribed text in LaTeX format.
    """
    try:
        with open(image_path, "rb") as image_file:
            image_data = image_file.read()

        # Use ChatCompletion with the Vision model
        response = client.chat.completions.create(
            model="gpt-4-turbo",
            messages=[
                {
                    "role": "system",
                    "content": "You are a helpful assistant that transcribes text from images."
                },
                {
                    "role": "user",
                    "content": "What does this image say?",
                    "attachments": [{"image": image_data}]
                }
            ]
        )


        print(f"Full Response: {response}")
        # Extract the transcription from the response
        latex_transcription = response.choices[0].message.content
        return latex_transcription
    finally:
        print("Done")

# Example usage:
# image_path = "path/to/your/image.png"
# latex_output = transcribe_image(image_path)
# print(latex_output)

transcribe_image("questions/question_1.png")