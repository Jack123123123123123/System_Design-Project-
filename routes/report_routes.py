from flask import Blueprint
from flask import jsonify
from extensions import db
from models.Sales import Sales
from sqlalchemy import func #SQLAlchemy 提供的 SQL 函式工具，例如 func.sum() 對應 SQL 的 SUM()。
from datetime import date
from models.Inventory import Inventory
from models.Scrap_record import ScrapRecord

report_bp = Blueprint(
    "report",
    __name__
)

@report_bp.route("/report/daily-sales")
def daily_sales():

    today = date.today()

    total = db.session.query(
        func.sum(Sales.subtotal)
    ).filter(
        func.date(Sales.created_at) == today
    ).scalar()

    return jsonify({
        "date": str(today),
        "daily_sales": total or 0
    })
#進銷存報表
@report_bp.route("/report/inventory-flow")
def inventory_flow():

    #總銷售
    total_sales = db.session.query(
        func.sum(Sales.subtotal)
    ).scalar() or 0

    #庫存總量
    total_stock = db.session.query(
        func.sum(Inventory.stock)
    ).scalar() or 0

    #損耗總量
    total_scrap = db.session.query(
        func.sum(ScrapRecord.quantity)
    ).scalar() or 0

    return jsonify({
        "total_sales": total_sales,
        "total_stock": total_stock,
        "total_scrap": total_scrap,
        "net_value": total_sales
    })
#損耗報表

#損耗統計
@report_bp.route("/report/loss")
def loss_report():

    result = db.session.query(
        ScrapRecord.reason,
        func.sum(ScrapRecord.quantity)
    ).group_by(
        ScrapRecord.reason
    ).all()

    data = []

    for r in result:
        data.append({
            "reason": r[0],
            "total_loss": r[1]
        })

    return jsonify(data)
#每日損耗報表
@report_bp.route("/report/daily-loss")
def daily_loss():

    result = db.session.query(
        func.date(ScrapRecord.scrap_date),
        func.sum(ScrapRecord.quantity)
    ).group_by(
        func.date(ScrapRecord.scrap_date)
    ).all()

    data = []

    for r in result:
        data.append({
            "date": str(r[0]),
            "loss_qty": r[1]
        })

    return jsonify(data)
