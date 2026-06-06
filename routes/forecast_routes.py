from flask import Blueprint
from flask import request
from flask import jsonify

from utils.forecast import predict_sales

forecast_bp = Blueprint(
    "forecast",
    __name__
)

@forecast_bp.route("/forecast")
def forecast():

    weather = int(
        request.args.get("weather")
    )

    holiday = int(
        request.args.get("holiday")
    )

    special = int(
        request.args.get("special")
    )

    event = int(
        request.args.get("event")
    )

    result = predict_sales(
        weather,
        holiday,
        special,
        event
    )

    return jsonify(result)