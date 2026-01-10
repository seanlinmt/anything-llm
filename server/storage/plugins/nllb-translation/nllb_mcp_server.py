#!/usr/bin/env python3
import sys
import json
import logging
import os
import traceback

# Add current directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from translate import translate_text

# Configure logging to stderr
logging.basicConfig(
    stream=sys.stderr,
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("nllb-mcp")

# Keep this path absolute as modules are large and shared
MODEL_PATH = "/home/sean/projects/cartara/models/facebook/nllb-200-distilled-600M"


def send_response(response):
    print(json.dumps(response), flush=True)


def handle_initialize(request):
    return {
        "protocolVersion": "2024-11-05",
        "capabilities": {"tools": {}},
        "serverInfo": {"name": "nllb-translator", "version": "1.0.0"},
    }


def handle_list_tools(request):
    return {
        "tools": [
            {
                "name": "translate",
                "description": "Translate text using NLLB-200 model. NLLB supports 200+ languages. Provide language codes (e.g., 'eng_Latn', 'fra_Latn', 'jpn_Jpan').",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "text": {
                            "type": "string",
                            "description": "The text to translate",
                        },
                        "target_lang": {
                            "type": "string",
                            "description": "The target language code (e.g. 'fra_Latn' for French, 'deu_Latn' for German, 'spa_Latn' for Spanish)",
                        },
                        "source_lang": {
                            "type": "string",
                            "description": "The source language code. Optional, defaults to auto-detector or 'eng_Latn' logic in the tool.",
                        },
                    },
                    "required": ["text", "target_lang"],
                },
            }
        ]
    }


def handle_call_tool(request):
    params = request.get("params", {})
    name = params.get("name")
    args = params.get("arguments", {})

    if name == "translate":
        text = args.get("text")
        target_lang = args.get("target_lang")
        source_lang = args.get("source_lang", None)

        if not text:
            raise ValueError("Argument 'text' is required")
        if not target_lang:
            raise ValueError("Argument 'target_lang' is required")

        logger.info(f"Translating to {target_lang}...")

        try:
            # translate_text returns the translated string
            result_text = translate_text(text, MODEL_PATH, source_lang, target_lang)
            return {"content": [{"type": "text", "text": result_text}]}
        except Exception as e:
            logger.error(f"Translation failed: {e}")
            logger.error(traceback.format_exc())
            return {
                "content": [{"type": "text", "text": f"Error: {str(e)}"}],
                "isError": True,
            }

    raise ValueError(f"Unknown tool: {name}")


def main():
    logger.info("NLLB MCP Server starting...")

    while True:
        try:
            line = sys.stdin.readline()
            if not line:
                break

            # Skip empty lines
            if not line.strip():
                continue

            request = json.loads(line)
            req_id = request.get("id")
            method = request.get("method")

            logger.debug(f"Received request: {method}")

            response = {"jsonrpc": "2.0", "id": req_id}

            try:
                if method == "initialize":
                    response["result"] = handle_initialize(request)
                elif method == "notifications/initialized":
                    # No response needed for notifications
                    continue
                elif method == "tools/list":
                    response["result"] = handle_list_tools(request)
                elif method == "tools/call":
                    response["result"] = handle_call_tool(request)
                elif method == "ping":
                    response["result"] = {}
                else:
                    logger.warning(f"Unknown method: {method}")
                    if req_id is not None:
                        response["error"] = {
                            "code": -32601,
                            "message": "Method not found",
                        }
                    else:
                        continue

                if req_id is not None:
                    send_response(response)

            except Exception as e:
                logger.error(f"Error handling request: {e}")
                if req_id is not None:
                    response["error"] = {"code": -32000, "message": str(e)}
                    send_response(response)

        except json.JSONDecodeError:
            logger.error("Invalid JSON received")
        except Exception as e:
            logger.error(f"Fatal loop error: {e}")
            break


if __name__ == "__main__":
    main()
