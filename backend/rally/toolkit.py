"""Official Agent Toolkit tracking handler, using our sandbox-only transport."""

import json

from paypal_agent_toolkit.shared.tracking.tool_handlers import create_shipment_tracking


def create(params, send):
    class Transport:
        def post(self, uri, payload):
            if uri != "/v1/shipping/trackers-batch" or len(payload.get("trackers", [])) != 1:
                raise ValueError("Only this order's single tracker is permitted.")
            tracker = payload["trackers"][0]
            # The toolkit builds the legacy batch shape; Orders v2 is PayPal's
            # current endpoint. Keep toolkit validation and use the guarded ledger.
            body = {"capture_id": tracker["transaction_id"], "tracking_number": tracker["tracking_number"], "carrier": "OTHER", "carrier_name_other": tracker["carrier"], "notify_payer": False}
            return send(body)
    return json.loads(create_shipment_tracking(Transport(), params))
