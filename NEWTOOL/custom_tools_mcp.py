
import sys
import json
import logging
import traceback
from base64 import b64encode
from io import BytesIO

# =============================================================================
# 1. MCP Server Framework (Reconstructed from snippets)
# =============================================================================

logging.basicConfig(level=logging.WARNING, format='[MCP-PY] %(levelname)s: %(message)s')

class StdioComms:
    """Handles JSON-RPC communication over stdin/stdout."""
    def read_message(self):
        line = sys.stdin.readline()
        if not line:
            return None
        return json.loads(line)

    def write_message(self, message):
        serialized = json.dumps(message)
        sys.stdout.write(serialized + '\n')
        sys.stdout.flush()

class Tool:
    def __init__(self, name, description, func, input_schema=None):
        self.name = name
        self.description = description
        self.func = func
        self.input_schema = input_schema or {"type": "object", "properties": {}}

    def to_dict(self):
        return {
            "name": self.name,
            "description": self.description,
            "inputSchema": self.input_schema,
        }

class ToolManager:
    def __init__(self):
        self._tools = {}

    def register_tool(self, tool):
        self._tools[tool.name] = tool
        logging.info(f"Tool '{tool.name}' registered.")

    def get_tool(self, name):
        return self._tools.get(name)

    def get_all_tools(self):
        return list(self._tools.values())

class Server:
    """A simple MCP Server."""
    def __init__(self):
        self._comms = StdioComms()
        self._tool_manager = ToolManager()

    def register_tool(self, name, description, func, input_schema=None):
        tool = Tool(name, description, func, input_schema)
        self._tool_manager.register_tool(tool)

    def serve_forever(self):
        logging.info("Server listening for messages...")
        while True:
            try:
                request = self._comms.read_message()
                if request is None:
                    break  # End of stream
                self.handle_request(request)
            except json.JSONDecodeError:
                logging.error("Failed to decode JSON message.")
                continue
            except Exception as e:
                logging.error(f"Critical error in server loop: {e}")
                break
        logging.info("Server shutting down.")

    def handle_request(self, request):
        msg_id = request.get('id')
        method = request.get('method')
        params = request.get('params', {})

        response = {
            "jsonrpc": "2.0",
            "id": msg_id
        }

        if method == 'initialize':
            response['result'] = {
                "protocolVersion": "2025-06-18",
                "serverInfo": {
                    "name": "custom_tools",
                    "version": "0.1.0",
                },
                "capabilities": {} 
            }
            self._comms.write_message(response)

        elif method == 'tools/list':
            tools = self._tool_manager.get_all_tools()
            response['result'] = {"tools": [t.to_dict() for t in tools]}
            self._comms.write_message(response)

        elif method == 'tools/call':
            tool_name = params.get('name')
            tool = self._tool_manager.get_tool(tool_name)

            if not tool:
                response['error'] = {"code": -32601, "message": f"Tool '{tool_name}' not found."}
                self._comms.write_message(response)
                return

            try:
                args = params.get('arguments', {})
                result_content = tool.func(**args)
                response['result'] = {"content": result_content}
            except Exception as e:
                tb_str = traceback.format_exc()
                logging.error(f"Error calling tool '{tool_name}': {e}\n{tb_str}")
                response['error'] = {"code": -32000, "message": f"Error executing tool: {e}"}
            
            self._comms.write_message(response)
        else:
            response['error'] = {"code": -32601, "message": f"Method '{method}' not found."}
            self._comms.write_message(response)


# =============================================================================
# 2. Tool Implementations
# =============================================================================

def get_weather(city: str):
    """
    Fetches the weather for a given city using wttr.in.
    """
    import requests
    if not city:
        raise ValueError("City cannot be empty.")
    
    url = f"https://wttr.in/{city}?format=3"
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        return [{"type": "text", "text": response.text.strip()}]
    except requests.RequestException as e:
        raise RuntimeError(f"Failed to fetch weather: {e}")

import os
SHOPPING_PLAN_FILE = "NEWTOOL/shopping_plan.json"

def _read_shopping_plan():
    if not os.path.exists(SHOPPING_PLAN_FILE):
        return []
    with open(SHOPPING_PLAN_FILE, 'r') as f:
        return json.load(f)

def _write_shopping_plan(plan):
    with open(SHOPPING_PLAN_FILE, 'w') as f:
        json.dump(plan, f, indent=2)

def update_shopping_plan(changes: str):
    """
    Updates the persistent shopping plan based on natural language changes.
    Supports 'add ITEM [quantity]' and 'remove ITEM' commands.
    """
    plan = _read_shopping_plan()
    summary = []

    lower_changes = changes.lower()

    if lower_changes.startswith("add "):
        parts = lower_changes[4:].strip().split(' ', 1)
        item_name = parts[0]
        quantity = 1
        if len(parts) > 1 and parts[1].isdigit():
            quantity = int(parts[1])
        
        found = False
        for item in plan:
            if item['name'].lower() == item_name:
                item['quantity'] += quantity
                summary.append(f"Updated '{item_name}' to quantity {item['quantity']}.")
                found = True
                break
        if not found:
            plan.append({"name": item_name, "quantity": quantity})
            summary.append(f"Added '{item_name}' with quantity {quantity}.")
    elif lower_changes.startswith("remove "):
        item_name = lower_changes[7:].strip()
        original_len = len(plan)
        plan = [item for item in plan if item['name'].lower() != item_name]
        if len(plan) < original_len:
            summary.append(f"Removed '{item_name}' from the plan.")
        else:
            summary.append(f"'{item_name}' not found in the plan.")
    else:
        summary.append("Unrecognized command. Try 'add ITEM [quantity]' or 'remove ITEM'.")
    
    _write_shopping_plan(plan)
    
    current_plan_display = "\nCurrent Shopping Plan:\n"
    if plan:
        for item in plan:
            current_plan_display += f"- {item['name']}: {item['quantity']}\n"
    else:
        current_plan_display += "  (empty)\n"

    return [{"type": "text", "text": "\n".join(summary) + current_plan_display}]


def get_btc_chart():
    """
    Generates and returns a PNG image of the Bitcoin price history.
    """
    import pandas as pd
    import matplotlib.pyplot as plt
    import requests
    from datetime import datetime
    import os

    # --- Fetch price ---
    url = "https://api.coingecko.com/api/v3/simple/price"
    params = {"ids": "bitcoin", "vs_currencies": "usd", "include_last_updated_at": "true"}
    resp = requests.get(url, params=params)
    resp.raise_for_status()
    data = resp.json()
    ts = datetime.fromtimestamp(data["bitcoin"]["last_updated_at"])
    price = data["bitcoin"]["usd"]

    # --- Save to CSV ---
    csv_path = "btc_price.csv" # Relative to script execution CWD
    file_exists = os.path.exists(csv_path)
    df_new = pd.DataFrame({"time": [ts], "price": [price]})
    df_new.to_csv(csv_path, mode='a', header=not file_exists, index=False)

    # --- Plot ---
    df = pd.read_csv(csv_path)
    df['time'] = pd.to_datetime(df['time'])
    if len(df) > 100:
        df = df.tail(100)
    
    fig, ax = plt.subplots(figsize=(8, 4))
    ax.plot(df["time"], df["price"], marker='o', linestyle='-', color='#006400')
    ax.set_title("Bitcoin Price History")
    ax.set_xlabel("Time")
    ax.set_ylabel("Price (USD)")
    ax.grid(True, alpha=0.3)
    fig.autofmt_xdate()
    plt.tight_layout()

    # --- Return image bytes ---
    buf = BytesIO()
    plt.savefig(buf, format='png', dpi=150)
    buf.seek(0)
    img_bytes = buf.read()
    
    # Encode as base64 and create MCP content block
    img_b64 = b64encode(img_bytes).decode('utf-8')
    return [{"type": "image", "data": img_b64, "mimeType": "image/png"}]


# =============================================================================
# 3. Server Main Entrypoint
# =============================================================================

if __name__ == "__main__":
    mcp_server = Server()

    mcp_server.register_tool(
        name="weather_check",
        description="Gets the current weather for a specified city.",
        func=get_weather,
        input_schema={
            "type": "object",
            "properties": {
                "city": {"type": "string", "description": "The city to get the weather for, e.g., 'London' or 'Tokyo'."}
            },
            "required": ["city"]
        }
    )

    mcp_server.register_tool(
        name="btc_chart",
        description="Generates a chart of recent Bitcoin price history.",
        func=get_btc_chart
    )

    mcp_server.register_tool(
        name="shopping__plan_update",
        description="Updates the persistent shopping plan based on natural language changes (add ITEM [quantity], remove ITEM).",
        func=update_shopping_plan,
        input_schema={
            "type": "object",
            "properties": {
                "changes": {"type": "string", "description": "Natural language command to modify the shopping plan."}
            },
            "required": ["changes"]
        }
    )

    mcp_server.serve_forever()
