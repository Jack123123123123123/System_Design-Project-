import math

def predict_sales(
    weather,
    holiday,
    special,
    event
):

    y = (
        18.04
        + 9.22 * weather
        + 112.64 * holiday
        + 34.12 * special
        + 115.40 * event
    )

    safe_y = y * 1.1

    noodle = math.ceil(safe_y / 15)

    cucumber = math.ceil(safe_y * 0.2)

    return {
        "predict_sales": round(y),
        "safe_stock_sales": round(safe_y),
        "noodle": noodle,
        "cucumber": cucumber
    }
