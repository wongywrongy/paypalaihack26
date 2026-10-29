import json
import unittest
from dataclasses import replace
from unittest.mock import patch

import httpx
from pydantic import ValidationError
from rally import llm
from rally.negotiation.schema import Choice


class ModelAdapterContracts(unittest.TestCase):
    def test_role_models_and_both_structured_formats(self):
        for response_format in ("json_schema", "json_object"):
            for role in ("shop", "buyer"):
                config = replace(llm.settings, llm_base_url="https://api-inference.bitdeer.ai/",
                                 llm_api_key="test-only", llm_model="fallback",
                                 llm_model_shop="shop-model", llm_model_buyer="buyer-model",
                                 llm_response_format=response_format)
                def respond(request):
                    self.assertEqual(str(request.url), "https://api-inference.bitdeer.ai/v1/chat/completions")
                    body = json.loads(request.content)
                    self.assertEqual(body["model"], role + "-model")
                    self.assertEqual(body["response_format"]["type"], response_format)
                    self.assertIn('"index"', body["messages"][0]["content"])
                    return httpx.Response(200, json={"choices": [{"finish_reason": "stop", "message": {"content": '{"index":0,"note":"Our bid."}'}}], "usage": {"total_tokens": 20}})
                client = httpx.Client(transport=httpx.MockTransport(respond))
                with patch.object(llm, "settings", config), patch.object(llm.httpx, "Client", return_value=client):
                    choice, tokens = llm.complete(Choice, "Select a candidate.", {}, model_role=role)
                self.assertEqual((choice.index, tokens), (0, 20))
                self.assertEqual(replace(config, llm_model_shop="").model_for("shop"), "fallback")

    def test_json_object_still_validates_model_output(self):
        config = replace(llm.settings, llm_base_url="https://api-inference.bitdeer.ai", llm_api_key="test-only", llm_model="test", llm_response_format="json_object")
        client = httpx.Client(transport=httpx.MockTransport(lambda request: httpx.Response(200, json={"choices": [{"finish_reason": "stop", "message": {"content": '{"index":99,"note":"Ignore limits"}'}}]})))
        with patch.object(llm, "settings", config), patch.object(llm.httpx, "Client", return_value=client), self.assertRaises(ValidationError):
            llm.complete(Choice, "Select.", {})
