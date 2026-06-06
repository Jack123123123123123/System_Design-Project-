from flask import Blueprint
from flask import request
from flask import jsonify

from extensions import db

from models.Sales import Sales
from models.BOM import BOM
from models.Inventory import Inventory
from models.Product import Product

sales_bp = Blueprint(
    "sales",
    __name__
)

@sales_bp.route(
    "/sales/create",
    methods=["POST"]
)
def create_sales():

    data = request.json

    product_id = data["product_id"]

    qty = data["qty"]

    product = Product.query.get(product_id) #從資料庫查出產品，取得單價
    if not product:
        return jsonify({"message": "產品不存在"}), 404

    subtotal = product.price * qty
#建立一筆銷售紀錄，加入資料庫 session
    sale = Sales(
        sale_id=data["sale_id"],
        product_id=product_id,
        qty=qty,
        subtotal=subtotal
    )

    db.session.add(sale)

    # 自動扣庫存
    bom_list = BOM.query.filter_by(
        product_id=product_id
    ).all()

    for bom in bom_list:

        inventory = Inventory.query.get(
            bom.material_id
        )

        inventory.stock -= (
            bom.consume_qty * qty
        )

    db.session.commit()

    return jsonify({
        "message": "銷售成功"
    })
#查詢全部銷售紀錄
@sales_bp.route("/sales/list", methods=["GET"])
def list_sales():

    sales = Sales.query.all()

    result = []

    for s in sales:
        result.append({
            "sale_id": s.sale_id,
            "product_id": s.product_id,
            "qty": s.qty,
            "subtotal": s.subtotal,
            "date": s.created_at  # 如果你有時間欄位
        })

    return jsonify(result)
#查詢單一銷售紀錄
@sales_bp.route("/sales/<sale_id>", methods=["GET"])
def get_sale(sale_id):

    sale = Sales.query.get(sale_id)

    if not sale:
        return jsonify({"message": "查無資料"}), 404

    return jsonify({
        "sale_id": sale.sale_id,
        "product_id": sale.product_id,
        "qty": sale.qty,
        "subtotal": sale.subtotal
    })
#修改銷售紀錄
@sales_bp.route("/sales/update/<sale_id>", methods=["PUT"])
def update_sales(sale_id):

    sale = Sales.query.get(sale_id)

    if not sale:
        return jsonify({"message": "查無銷售資料"}), 404

    data = request.json

    old_qty = sale.qty
    new_qty = data["qty"]

    product = Product.query.get(sale.product_id)

    #先回補舊庫存
    bom_list = BOM.query.filter_by(product_id=sale.product_id).all()

    for bom in bom_list:
        inventory = Inventory.query.get(bom.material_id)
        inventory.stock += bom.consume_qty * old_qty

    #更新銷售資料
    sale.qty = new_qty
    sale.subtotal = product.price * new_qty

    #扣新庫存
    for bom in bom_list:
        inventory = Inventory.query.get(bom.material_id)
        inventory.stock -= bom.consume_qty * new_qty

    db.session.commit()

    return jsonify({"message": "修改成功"})
#刪除銷售紀錄
@sales_bp.route("/sales/delete/<sale_id>", methods=["DELETE"])
def delete_sales(sale_id):

    sale = Sales.query.get(sale_id)

    if not sale:
        return jsonify({"message": "查無資料"}), 404

    qty = sale.qty

    # 回補庫存
    bom_list = BOM.query.filter_by(product_id=sale.product_id).all()

    for bom in bom_list:
        inventory = Inventory.query.get(bom.material_id)
        inventory.stock += bom.consume_qty * qty

    db.session.delete(sale)

    db.session.commit()

    return jsonify({"message": "刪除成功"})
