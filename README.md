# PyHamilton Script Generator with Gemini

A Streamlit-based user interface that leverages Google's Gemini models to generate PyHamilton automation scripts.

## Features
- **Interactive UI**: Select labware, input protocol descriptions, and upload deck layouts.
- **Multimodal Inputs**: Supports both text descriptions and image inputs (e.g., diagrams, deck layouts) for context.
- **Code Generation**: Automatically generates valid `pyhamilton` Python scripts.
- **Download**: Easily download the generated script to run on your device.

## Prerequisites
- Python 3.9+
- A Google Cloud Project with the Gemini API enabled and an API key.

## Installation

1.  Clone this repository or navigate to the folder.
2.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```

## Usage

1.  Run the application:
    ```bash
    streamlit run app.py
    ```
2.  Open the URL provided in the terminal (usually `http://localhost:8501`).
3.  Enter your **Google Gemini API Key** in the sidebar.
4.  Configure your deck, describe your protocol, and (optional) upload an image.
5.  Click **Generate Script** and download the result.

## Project Structure
- `app.py`: Main application entry point.
- `prompt_engineering.py`: Helper module for constructing prompts.
- `requirements.txt`: Python dependencies.
