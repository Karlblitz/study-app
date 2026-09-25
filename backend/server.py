"""Local Gemini endpoint for Studyspace lecture summaries."""

import json
import os
import base64
import io
import re
import time
from threading import Lock
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from google import genai


HOST = "127.0.0.1"
PORT = 8000
MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")
MAX_REQUEST_BYTES = 4_500_000
MAX_NOTES_CHARACTERS = 120_000
MAX_VIDEO_BYTES = 3 * 1024 * 1024
SUPPORTED_VIDEO_TYPES = {
    "video/mp4", "video/mpeg", "video/mov", "video/avi", "video/x-flv",
    "video/mpg", "video/webm", "video/wmv", "video/3gpp",
}
ALLOWED_ORIGINS = {
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
}

# Keep the SDK's HTTP client alive across requests. The summary endpoint uses a
# threaded server, so guard creation and API-key changes with a lock.
_gemini_client = None
_gemini_api_key = None
_gemini_client_lock = Lock()


def get_gemini_client(api_key):
    global _gemini_client, _gemini_api_key
    with _gemini_client_lock:
        if _gemini_client is None or _gemini_api_key != api_key:
            if _gemini_client is not None:
                _gemini_client.close()
            _gemini_client = genai.Client(api_key=api_key)
            _gemini_api_key = api_key
        return _gemini_client


class SummaryHandler(BaseHTTPRequestHandler):
    def _json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        origin = self.headers.get("Origin")
        if origin in ALLOWED_ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        origin = self.headers.get("Origin")
        self.send_response(204)
        if origin in ALLOWED_ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Max-Age", "600")
        self.end_headers()

    def do_POST(self):
        if self.path != "/api/summarize":
            self._json(404, {"error": "Endpoint not found."})
            return

        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            self._json(503, {"error": "Set GEMINI_API_KEY in the terminal running the Python summary server."})
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > MAX_REQUEST_BYTES:
                self._json(413, {"error": "The notes are empty or too large to summarize."})
                return
            payload = json.loads(self.rfile.read(length))
            if not isinstance(payload, dict):
                self._json(400, {"error": "The summary request was not valid JSON."})
                return
            raw_notes = payload.get("notes", "")
            if not isinstance(raw_notes, str):
                self._json(400, {"error": "Add lecture notes or a transcript before creating a summary."})
                return
            notes = raw_notes.strip()
            raw_title = payload.get("title", "Lecture notes")
            raw_subject = payload.get("subject", "")
            video_data = payload.get("videoData", "")
            video_type = payload.get("videoType", "")
            video_name = payload.get("videoName", "lecture-video")
            video_url = payload.get("videoUrl", "")
            title = raw_title.strip()[:300] if isinstance(raw_title, str) else "Lecture notes"
            subject = raw_subject.strip()[:200] if isinstance(raw_subject, str) else ""
            if not isinstance(video_url, str):
                self._json(400, {"error": "The video link is not valid."})
                return
            if video_url and not re.fullmatch(r"https?://(?:www\.)?(?:youtube\.com/(?:watch\?v=[\w-]+|shorts/[\w-]+|live/[\w-]+)|youtu\.be/[\w-]+)(?:[^\s]*)", video_url):
                self._json(400, {"error": "Use a public YouTube video link, or upload a supported video file."})
                return
            if not notes and not video_data and not video_url:
                self._json(400, {"error": "Add lecture notes or a transcript before creating a summary."})
                return
            if len(notes) > MAX_NOTES_CHARACTERS:
                self._json(413, {"error": "This lecture has too much text. Use up to 120,000 characters."})
                return
            video_bytes = None
            if video_data:
                if not isinstance(video_data, str) or not isinstance(video_type, str) or video_type.lower() not in SUPPORTED_VIDEO_TYPES:
                    self._json(415, {"error": "This video format is not supported. Use MP4, MPEG, MOV, AVI, FLV, MPG, WebM, WMV, or 3GPP."})
                    return
                encoded = video_data.partition(",")[2] if video_data.startswith("data:") else video_data
                try:
                    video_bytes = base64.b64decode(encoded, validate=True)
                except (ValueError, base64.binascii.Error):
                    self._json(400, {"error": "The video upload could not be read. Please attach it again."})
                    return
                if not video_bytes or len(video_bytes) > MAX_VIDEO_BYTES:
                    self._json(413, {"error": "Videos must be 3 MB or smaller for this app."})
                    return
        except (ValueError, TypeError, json.JSONDecodeError):
            self._json(400, {"error": "The summary request was not valid JSON."})
            return

        source_prompt = (
            "Create detailed, well-organized study notes from this lecture video. "
            "Explain the main ideas, definitions, examples, and steps shown or spoken. "
            "Use clear headings and bullets. Include a short key-takeaways section. "
            "If accompanying notes are provided, use them too. Only state information "
            "supported by the video or notes; say when something is unclear."
            if video_bytes or video_url else
            "Create a clear study summary using only the source notes below. "
            "Keep the key concepts, definitions, formulas, and important relationships. "
            "Use clear headings and useful bullet points. Do not add facts that are not present."
        )
        prompt = f"{source_prompt}\n\nLecture: {title}\nSubject: {subject or 'Not provided'}"
        if notes:
            prompt += f"\n\nSOURCE NOTES:\n{notes}"
        try:
            client = get_gemini_client(api_key)
            uploaded_video = None
            contents = [prompt]
            if video_url:
                response = client.interactions.create(
                    model=MODEL,
                    input=[{"type": "video", "uri": video_url}, {"type": "text", "text": prompt}],
                )
                summary = (response.output_text or "").strip()
                if not summary:
                    self._json(502, {"error": "Gemini returned an empty summary. Try again."})
                    return
                self._json(200, {"summary": summary})
                return
            if video_bytes:
                clean_name = re.sub(r"[^A-Za-z0-9._-]+", "_", str(video_name))[:120] or "lecture-video"
                uploaded_video = client.files.upload(
                    file=io.BytesIO(video_bytes),
                    config={"mime_type": video_type.lower(), "display_name": clean_name},
                )
                deadline = time.monotonic() + 180
                while not uploaded_video.state or uploaded_video.state.name == "PROCESSING":
                    if time.monotonic() >= deadline:
                        raise TimeoutError("Gemini took too long to process the video. Try a shorter clip.")
                    time.sleep(2)
                    uploaded_video = client.files.get(name=uploaded_video.name)
                if uploaded_video.state.name != "ACTIVE":
                    raise RuntimeError("Gemini could not process this video. Try a different video file.")
                contents.insert(0, uploaded_video)
            response = client.models.generate_content(
                model=MODEL,
                contents=contents,
            )
            summary = (response.text or "").strip()
            if not summary:
                self._json(502, {"error": "Gemini returned an empty summary. Try again."})
                return
            self._json(200, {"summary": summary})
        except Exception as error:
            details = str(error).replace(api_key, "[REDACTED]")[:500]
            print(f"Gemini summary request failed ({type(error).__name__}): {details}", flush=True)
            self._json(502, {"error": "Gemini request failed. Check the Python service terminal for the redacted error details."})
        finally:
            if 'uploaded_video' in locals() and uploaded_video is not None:
                try:
                    get_gemini_client(api_key).files.delete(name=uploaded_video.name)
                except Exception as cleanup_error:
                    print(f"Gemini temporary video cleanup failed ({type(cleanup_error).__name__}).", flush=True)

    def log_message(self, _format, *_args):
        # Avoid logging lecture text or request details to the console.
        return


if __name__ == "__main__":
    print(f"Studyspace summary service listening at http://{HOST}:{PORT}")
    print("Set GEMINI_API_KEY in this terminal before starting the service.")
    ThreadingHTTPServer((HOST, PORT), SummaryHandler).serve_forever()
