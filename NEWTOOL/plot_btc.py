#!/usr/bin/env python3
"""
Simple Bitcoin price chart generator.
Author: Francine (local AI helper)
"""

import json
import requests
import pandas as pd
import matplotlib.pyplot as plt
from datetime import datetime

# ── Step 1: Pull the latest price data ------------------------------------
def fetch_bitcoin_price():
    """
    Query CoinGecko API for the current Bitcoin price (USD).
    Returns a tuple (timestamp, price_usd).
    """
    url = "https://api.coingecko.com/api/v3/simple/price"
    params = {
        "ids": "bitcoin",
        "vs_currencies": "usd",
        "include_last_updated_at": True
    }
    resp = requests.get(url, params=params)
    data = resp.json()
    ts = datetime.fromtimestamp(data["bitcoin"]["last_updated_at"])
    price = data["bitcoin"]["usd"]
    return ts, price

import os

# ── Step 2: Store the data locally ------------------------------------------
def save_to_csv(timestamp, price, filename="btc_price.csv"):
    """Appends a new timestamp and price to the CSV."""
    file_exists = os.path.exists(filename)
    df = pd.DataFrame({"time": [timestamp], "price": [price]})
    df.to_csv(filename, mode='a', header=not file_exists, index=False)

# ── Step 3: Plot the price --------------------------------------------------
def plot_price(csv_path="btc_price.csv", out_png="btc_chart.png"):
    if not os.path.exists(csv_path):
        print(f"Price data file not found: {csv_path}")
        return

    df = pd.read_csv(csv_path)
    # Convert time column from string to datetime objects
    df['time'] = pd.to_datetime(df['time'])
    
    # Keep only the last N data points to avoid clutter
    max_points = 100
    if len(df) > max_points:
        df = df.tail(max_points)

    fig, ax = plt.subplots(figsize=(8, 4))
    ax.plot(df["time"], df["price"], marker='o', linestyle='-', color='#006400')
    ax.set_title("Bitcoin Price History")
    ax.set_xlabel("Time")
    ax.set_ylabel("Price (USD)")
    ax.grid(True, alpha=0.3)
    
    # Improve date label formatting
    fig.autofmt_xdate() 

    plt.tight_layout()
    plt.savefig(out_png, dpi=150)
    print(f"Chart saved to {out_png}")

# ── Main routine -------------------------------------------------------------
if __name__ == "__main__":
    ts, price = fetch_bitcoin_price()
    print(f"Fetched price: ${price} at {ts}")
    save_to_csv(ts, price)
    plot_price()
