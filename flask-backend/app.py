from flask import Flask, request, jsonify
from deep_translator import GoogleTranslator
from flask_cors import CORS
import os

app = Flask(__name__)
CORS(app, resources={r"/translate": {"origins": "*"}})

@app.route('/translate', methods=['POST'])
def translate_text():
    data = request.json
    text = data.get('text')
    source_lang = data.get('source', 'auto')
    target_lang = data.get('target', 'en')

    if not text:
        return jsonify({'error': 'No text provided'}), 400

    try:
        translator = GoogleTranslator(source=source_lang, target=target_lang)
        translated = translator.translate(text)
        detected_lang = translator.get_supported_languages(as_dict=True).get(translator.source, 'unknown')
        return jsonify({
            'translatedText': translated,
            'detectedSource': translator.source
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=True, host='0.0.0.0', port=port)
