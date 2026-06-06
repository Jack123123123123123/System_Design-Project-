# routes/purchase_routes.py
from flask import Blueprint, request, jsonify
from extensions import db

from models.Purchase import Purchase
from models.Inventory import Inventory

purchase_bp = Blueprint("purchase", __name__)
# 新增進貨紀錄
@purchase_bp.route("/purchase/create", methods=["POST"])
def create_purchase():

    data = request.json

    purchase_id = data["purchase_id"]
    material_id = data["material_id"]
    qty = data["qty"]
    cost = data["cost"]

    total = qty * cost

    #新增進貨紀錄
    purchase = Purchase(
        purchase_id=purchase_id,
        material_id=material_id,
        qty=qty,
        cost=cost,
        total=total
    )

    db.session.add(purchase)

    #回補庫存
    inventory = Inventory.query.get(material_id)

    if inventory:
        inventory.stock += qty
    else:
        return jsonify({"message": "原料不存在"}), 404

    db.session.commit()

    return jsonify({"message": "進貨成功"})
#查詢進貨紀錄
@purchase_bp.route("/purchase/list", methods=["GET"])
def list_purchase():

    purchases = Purchase.query.all()

    result = []

    for p in purchases:
        result.append({
            "purchase_id": p.purchase_id,
            "material_id": p.material_id,
            "qty": p.qty,
            "cost": p.cost,
            "total": p.total,
            "created_at": p.created_at
        })

    return jsonify(result)
#查詢單一進貨紀錄
@purchase_bp.route("/purchase/<purchase_id>", methods=["GET"])
def get_purchase(purchase_id):

    p = Purchase.query.get(purchase_id)

    if not p:
        return jsonify({"message": "查無資料"}), 404

    return jsonify({
        "purchase_id": p.purchase_id,
        "material_id": p.material_id,
        "qty": p.qty,
        "cost": p.cost,
        "total": p.total
    })
#修改進貨紀錄
@purchase_bp.route("/purchase/update/<purchase_id>", methods=["PUT"])
def update_purchase(purchase_id):

    p = Purchase.query.get(purchase_id)

    if not p:
        return jsonify({"message": "查無資料"}), 404

    data = request.json

    new_qty = data["qty"]
    new_cost = data["cost"]

    inventory = Inventory.query.get(p.material_id)

    #回補舊庫存
    inventory.stock -= p.qty

    #更新資料
    p.qty = new_qty
    p.cost = new_cost
    p.total = new_qty * new_cost

    #加回新庫存
    inventory.stock += new_qty

    db.session.commit()

    return jsonify({"message": "更新成功"})
#刪除進貨紀錄
@purchase_bp.route("/purchase/delete/<purchase_id>", methods=["DELETE"])
def delete_purchase(purchase_id):

    p = Purchase.query.get(purchase_id)

    if not p:
        return jsonify({"message": "查無資料"}), 404

    inventory = Inventory.query.get(p.material_id)

    # 扣回庫存
    inventory.stock -= p.qty

    db.session.delete(p)

    db.session.commit()

    return jsonify({"message": "刪除成功"})
