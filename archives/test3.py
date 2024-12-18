import base64
from openai import OpenAI

client = OpenAI()

question = """
(a) (2 points) True or False: the set of all (grammatical) English sentences is countably infinite. You may make the assumption that sentences consist only of lower case letters, spaces, and the following punctuation: ., !, and ?. Also, all English sentences have finite length. Defend your answer.

Solution: True. There are many possible solutions to this question. Given that all English sentences have finite length, we can order sentences by their length. Consider the set of sentences whose length is \( N \). This set will also be countable because it is finite. Therefore, the set of all grammatical sentences is countably infinite as it is the union of a series of countable sets.

Another solution is to map the set of characters to integers (lower case characters are mapped to the numbers 1-26 and the spaces and punctuation characters are mapped to the succeeding numbers 27-30) so that each sentence can be mapped to a base-31 integer."
"""

def transcribe_answer(image_path):
    # Function to encode the image
    def encode_image(image_path):
        with open(image_path, "rb") as image_file:
            return base64.b64encode(image_file.read()).decode('utf-8')

    # Path to your image

    # Getting the base64 string
    base64_image = encode_image(image_path)

    response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[
        {
        "role": "user",
        "content": [
            {
            "type": "text",
            "text": f"Transcribe the student's answer to the question, using LaTeX format only when necessary for equations. The question and solution are (to provide context for the transcription): {question}. The handwriting may be bad, so try to make accurate sense of it.",
            },
            {
            "type": "image_url",
            "image_url": {
                "url":  f"data:image/jpeg;base64,{base64_image}"
            },
            },
        ],
        }
    ],
    )

    return f"Question: {response.choices[0].message.content}" 


print(transcribe_answer("q_exam3_1a/student1.png"))