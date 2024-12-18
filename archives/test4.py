from openai import OpenAI

client = OpenAI()

# student_answer = """
# (a) To prove true, we must map every element in the strings to a natural number, forming a bijection between elements in the set and all natural numbers.

# First, consider the characters \( a, b, \ldots, z, \), \( \text{ } \), \( . \), \( ! \), and \( ? \) (the space). Let's say \( a = 1, b = 2, \ldots, z = 26, \text{ } = 27, . = 28, ! = 29, ? = 30 \). We can then generate all sentences by starting with strings of length \( 1 \), of which there are \( 30 \), then lengths of strings of length \( 2 \) (corresponding to the variable \( N \) labeled with \( N = 2 \) and so on. String \( 1 \) (length \( 1 \)) can be mapped to natural \( 1 \), length \( 2 \) to natural \( 31 \), and so on. 

# Therefore, we can generate all English sentences in a structured order, giving us a bijection between all sentences and natural numbers. Therefore, the set of all sentences is countably infinite.

# Because the set of all grammatically correct English sentences is a subset of the set of all English sentences, the set must also be countably infinite.

# Therefore, the answer is True.
# """

def grade_student(question, solution, student_answer):

    response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[
        {
        "role": "user",
        "content": [
            {
            "type": "text",
            "text": f"""
            Your role is to be an accurate and fair grader for an Automata & Complexity Theory computer science college course.
            
            Given:
            Question: {question}
            Solution: {solution}
            Student's answer: {student_answer}
            
            The rubric is as follows:
            - 2 points: The student's answer is correct and complete.
            - 1.5 points: Student selects "True", but minor error
            - 1 point: Student selects "True", but major error or invalid justification
            - 0.5 points: Student selects "True", but missing justification
            - 0 points: Student selects "False" or no solution

            Provide your score and comments on errors, if any. Do not hesitate to doc points off. For the comments, be as specific as possible and stay ***VERY*** brief, talking in a POV to the student.
            """,
            },
        ],
        }
    ],
    )

    return f"{response.choices[0].message.content}" 

######

question = """
(a) (2 points) True or False: the set of all (grammatical) English sentences is countably infinite. You may make the assumption that sentences consist only of lower case letters, spaces, and the following punctuation: ., !, and ?. Also, all English sentences have finite length. Defend your answer.
"""

solution = """
Solution: True. There are many possible solutions to this question. Given that all English sentences have finite length, we can order sentences by their length. Consider the set of sentences whose length is \( N \). This set will also be countable because it is finite. Therefore, the set of all grammatical sentences is countably infinite as it is the union of a series of countable sets.

Another solution is to map the set of characters to integers (lower case characters are mapped to the numbers 1-26 and the spaces and punctuation characters are mapped to the succeeding numbers 27-30) so that each sentence can be mapped to a base-31 integer."
"""

from test3 import transcribe_answer
import os

for image in os.listdir("q_exam3_1a"):
    student_answer = transcribe_answer(f"q_exam3_1a/{image}")
    print(f"Student answer: {student_answer}")
    print(grade_student(question, solution, student_answer))
    print("---")