"""Prompt-hash cache for synthetic benchmark calls only, never production buyers."""

import hashlib
import json
from pathlib import Path
from threading import Lock

from ..config import settings


class ModelCache:
    def __init__(self, complete, directory):
        self.complete = complete
        self.directory = Path(directory)
        self.directory.mkdir(parents=True, exist_ok=True)
        self.guard = Lock()
        self.locks = {}
        self.failures = 0

    def __call__(self, schema, role, payload, **kwargs):
        prompt = json.dumps({"schema": schema.model_json_schema(), "role": role, "payload": payload, "model": settings.model_for(kwargs.get("model_role")), "model_role": kwargs.get("model_role"), "response_format": settings.llm_response_format, "max_tokens": kwargs.get("max_tokens"), "protocol": settings.llm_protocol, "endpoint": settings.llm_base_url}, sort_keys=True)
        key = hashlib.sha256(prompt.encode()).hexdigest()
        with self.guard:
            lock = self.locks.setdefault(key, Lock())
        with lock:
            path = self.directory / (key + ".json")
            if path.is_file():
                value = json.loads(path.read_text())
                return schema.model_validate(value["result"]), value["tokens"]
            try:
                result, tokens = self.complete(schema, role, payload, **kwargs)
            except Exception:
                with self.guard:
                    self.failures += 1
                raise
            path.write_text(json.dumps({"result": result.model_dump(), "tokens": tokens}))
            return result, tokens
