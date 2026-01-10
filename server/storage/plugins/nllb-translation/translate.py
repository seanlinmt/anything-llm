#!/usr/bin/env python3
import argparse
import sys
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
import torch


def chunk_text(text, tokenizer, max_tokens=900):
    """
    Split text into chunks that fit within token limits.
    Tries to split on sentence boundaries for better translation quality.
    Falls back to comma/clause splitting, then word-level if needed.
    """
    import re

    # First check if text is already under limit
    total_tokens = len(tokenizer.encode(text, add_special_tokens=False))
    if total_tokens <= max_tokens:
        return [text]

    # Try splitting into sentences (. ! ?)
    sentences = re.split(r"(?<=[.!?])\s+", text)

    # If only 1 "sentence" (no punctuation found), try splitting on commas/semicolons
    if len(sentences) == 1:
        # Split on commas, semicolons, or newlines
        sentences = re.split(r"(?<=[,;])\s+|\n+", text)

    # If still only 1 segment, split on whitespace (words)
    if len(sentences) == 1:
        sentences = text.split()

    chunks = []
    current_chunk = ""

    for segment in sentences:
        # Check if adding this segment would exceed limit
        test_chunk = current_chunk + " " + segment if current_chunk else segment
        token_count = len(tokenizer.encode(test_chunk, add_special_tokens=False))

        if token_count <= max_tokens:
            current_chunk = test_chunk
        else:
            # Save current chunk if not empty
            if current_chunk.strip():
                chunks.append(current_chunk.strip())

            # Check if single segment is too long
            segment_tokens = len(tokenizer.encode(segment, add_special_tokens=False))
            if segment_tokens > max_tokens:
                # Split long segment by words
                words = segment.split()
                current_chunk = ""
                for word in words:
                    test_chunk = current_chunk + " " + word if current_chunk else word
                    if (
                        len(tokenizer.encode(test_chunk, add_special_tokens=False))
                        <= max_tokens
                    ):
                        current_chunk = test_chunk
                    else:
                        if current_chunk.strip():
                            chunks.append(current_chunk.strip())
                        current_chunk = word
            else:
                current_chunk = segment

    # Don't forget the last chunk
    if current_chunk.strip():
        chunks.append(current_chunk.strip())

    return chunks


def translate_text(input_text, model_name, src_lang, tgt_lang):
    import time

    if not input_text or not isinstance(input_text, str) or not input_text.strip():
        print("Error: Empty input text.", file=sys.stderr)
        sys.exit(1)

    total_start = time.time()

    print(f"Loading model from: {model_name}...", file=sys.stderr)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Using device: {device}", file=sys.stderr)

    # Track GPU memory
    def get_gpu_memory():
        if torch.cuda.is_available():
            allocated = torch.cuda.memory_allocated() / 1024**3
            reserved = torch.cuda.memory_reserved() / 1024**3
            return f"GPU Memory: {allocated:.2f}GB allocated, {reserved:.2f}GB reserved"
        return "GPU: N/A"

    load_start = time.time()
    try:
        tokenizer = AutoTokenizer.from_pretrained(model_name)
        model = AutoModelForSeq2SeqLM.from_pretrained(model_name).to(device)
    except Exception as e:
        print(f"Error loading model: {e}", file=sys.stderr)
        sys.exit(1)
    load_time = time.time() - load_start
    print(f"Model loaded in {load_time:.2f}s. {get_gpu_memory()}", file=sys.stderr)

    try:
        # Handle Multilingual Models (NLLB, M2M100, MBART)
        if hasattr(tokenizer, "src_lang") and src_lang:
            try:
                tokenizer.src_lang = src_lang
            except ValueError:
                pass

        # Chunk text if too long
        chunks = chunk_text(input_text, tokenizer, max_tokens=900)

        if len(chunks) > 1:
            print(
                f"Text split into {len(chunks)} chunks for translation.",
                file=sys.stderr,
            )

        # Handle Target Language
        generate_kwargs = {}
        target_lang_id = None
        try:
            target_lang_id = tokenizer.convert_tokens_to_ids(tgt_lang)
            if target_lang_id == tokenizer.unk_token_id:
                target_lang_id = None
        except Exception:
            pass

        if target_lang_id is None and hasattr(tokenizer, "lang_code_to_id"):
            if tgt_lang in tokenizer.lang_code_to_id:
                target_lang_id = tokenizer.lang_code_to_id[tgt_lang]

        if target_lang_id is not None:
            generate_kwargs["forced_bos_token_id"] = target_lang_id
        else:
            print(
                f"Warning: Could not resolve token ID for target language '{tgt_lang}'.",
                file=sys.stderr,
            )

        # Translate each chunk
        translated_chunks = []
        translate_start = time.time()

        for i, chunk in enumerate(chunks):
            chunk_start = time.time()
            if len(chunks) > 1:
                print(f"Translating chunk {i + 1}/{len(chunks)}...", file=sys.stderr)

            inputs = tokenizer(chunk, return_tensors="pt").to(device)

            with torch.no_grad():
                outputs = model.generate(**inputs, **generate_kwargs)

            decoded = tokenizer.batch_decode(outputs, skip_special_tokens=True)[0]
            translated_chunks.append(decoded)

            chunk_time = time.time() - chunk_start
            if len(chunks) > 1:
                print(f"  Chunk {i + 1} done in {chunk_time:.2f}s", file=sys.stderr)

        translate_time = time.time() - translate_start
        total_time = time.time() - total_start

        # Join translated chunks
        full_translation = " ".join(translated_chunks)

        # Print stats
        print(f"\n--- Stats ---", file=sys.stderr)
        print(f"Model load time: {load_time:.2f}s", file=sys.stderr)
        print(
            f"Translation time: {translate_time:.2f}s ({len(chunks)} chunks)",
            file=sys.stderr,
        )
        print(f"Total time: {total_time:.2f}s", file=sys.stderr)
        print(f"{get_gpu_memory()}", file=sys.stderr)
        print(f"-------------", file=sys.stderr)

        return full_translation

    except Exception as e:
        print(f"Error during translation: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Translate text using a local Transformers model."
    )

    parser.add_argument(
        "input_text",
        type=str,
        nargs="?",
        help="The text string to translate. Optional if --file is used.",
    )
    parser.add_argument(
        "--file",
        dest="file_path",
        help="Path to a text file containing the input text.",
    )
    parser.add_argument(
        "--model",
        dest="model_name",
        required=True,
        help="HuggingFace model name or local path (e.g., 'facebook/nllb-200-distilled-600M').",
    )
    parser.add_argument(
        "--src-lang",
        dest="src_lang",
        required=False,
        help="Input language code (e.g., 'eng_Latn', 'en'). Optional if input is JSON with language_code.",
    )
    parser.add_argument(
        "--tgt-lang",
        dest="tgt_lang",
        required=True,
        help="Output language code (e.g., 'fra_Latn', 'fr').",
    )

    args = parser.parse_args()

    text_to_translate = args.input_text

    if args.file_path:
        try:
            with open(args.file_path, "r", encoding="utf-8") as f:
                text_to_translate = f.read().strip()
        except Exception as e:
            print(f"Error reading file: {e}", file=sys.stderr)
            sys.exit(1)

    if not text_to_translate:
        # Check if input is being piped
        if not sys.stdin.isatty():
            text_to_translate = sys.stdin.read().strip()

    # Try to parse as JSON if it looks like JSON
    if text_to_translate and text_to_translate.startswith("{"):
        try:
            import json

            data = json.loads(text_to_translate)
            if "text" in data:
                text_to_translate = data["text"]

                # Auto-detect source language if not provided by user argument
                if not args.src_lang and "language_code" in data:
                    detected_code = data["language_code"]
                    if len(detected_code) == 2:
                        try:
                            # Heuristic: try to guess 3-letter code + Latn
                            import pycountry

                            lang = pycountry.languages.get(alpha_2=detected_code)
                            if lang and hasattr(lang, "alpha_3"):
                                # Defaulting to Latn script for simplicity in this auto-mode
                                args.src_lang = f"{lang.alpha_3}_Latn"
                                print(
                                    f"Auto-detected source language from JSON: {args.src_lang}",
                                    file=sys.stderr,
                                )
                        except ImportError:
                            pass
                    elif len(detected_code) >= 3:
                        args.src_lang = detected_code
                        print(
                            f"Using source language from JSON: {args.src_lang}",
                            file=sys.stderr,
                        )
        except Exception:
            # Not valid JSON, treat as raw text
            pass

    if not text_to_translate:
        print(
            "Error: You must provide input text via argument, --file, or piped stdin.",
            file=sys.stderr,
        )
        sys.exit(1)

    if not args.src_lang:
        print(
            "Error: --src-lang was not provided and could not be inferred from input JSON.",
            file=sys.stderr,
        )
        sys.exit(1)

    result = translate_text(
        text_to_translate, args.model_name, args.src_lang, args.tgt_lang
    )
    print("\n--- Translation ---")
    print(result)
    print("-------------------")
