from flask import Blueprint
from flask import jsonify
from flask import request
from models.Inventory import Inventory
from datetime import datetime
from models.Scrap_record import ScrapRecord
from models.BOM import BOM
from extensions import db

inventory_bp = Blueprint(
    "inventory",
    __name__
)
#查詢單一原料庫存
@inventory_bp.route(
    "/inventory/<material_id>",
    methods=["GET"]
)
def get_inventory(material_id):

    inventory = Inventory.query.get(material_id)

    if not inventory:
        return jsonify({
            "message":"查無資料"
        }),404

    return jsonify({
        "material_id":inventory.material_id,
        "material_name":inventory.material_name,
        "stock":inventory.stock,
        "safe_stock":inventory.safe_stock
    })
#查詢全部庫存
@inventory_bp.route("/inventory/list")
def inventory_list():

    inventories = Inventory.query.all()

    result = []

    for i in inventories:

        result.append({
            "material_id": i.material_id,
            "material_name": i.material_name,
            "stock": i.stock,
            "safe_stock": i.safe_stock
        })

    return jsonify(result)
#查詢安全庫存
@inventory_bp.route(
    "/inventory/safe-stock",
    methods=["GET"]
)
def safe_stock_list():

    inventories = Inventory.query.all()

    result = []

    for i in inventories:

        if i.stock <= i.safe_stock:

            result.append({
                "material_id":i.material_id,
                "material_name":i.material_name,
                "stock":i.stock,
                "safe_stock":i.safe_stock
            })

    return jsonify(result)
#紀錄原料報廢API
@inventory_bp.route(
    "/inventory/scrap",
    methods=["POST"]
)
def scrap_material():

    data = request.json

    inventory = Inventory.query.get(
        data["material_id"]
    )

    if not inventory:
        return jsonify({
            "message":"原料不存在"
        }),404

    qty = int(data["quantity"])

    if qty > inventory.stock:

        return jsonify({
            "message":"庫存不足"
        }),400

    inventory.stock -= qty

    scrap = ScrapRecord(
        material_id=inventory.material_id,
        material_name=inventory.material_name,
        quantity=qty,
        reason=data["reason"],
        scrap_date=datetime.now()
    )

    db.session.add(scrap)

    db.session.commit()

    return jsonify({
        "message":"報廢成功"
    })
#查詢報廢紀錄
@inventory_bp.route(
    "/inventory/scrap/list",
    methods=["GET"]
)
def scrap_list():

    records = ScrapRecord.query.all()

    result = []

    for r in records:

        result.append({
            "material_id":r.material_id,
            "material_name":r.material_name,
            "quantity":r.quantity,
            "reason":r.reason,
            "scrap_date":r.scrap_date
        })

    return jsonify(result)
#新增BOM
@inventory_bp.route(
    "/bom/add",
    methods=["POST"]
)
def add_bom():

    data = request.json

    bom = BOM(
        product_name=data["product_name"],
        material_id=data["material_id"],
        quantity=data["quantity"]
    )

    db.session.add(bom)

    db.session.commit()

    return jsonify({
        "message":"新增成功"
    })
#查詢BOM
@inventory_bp.route(
    "/bom/list",
    methods=["GET"]
)
def bom_list():

    boms = BOM.query.all()

    result = []

    for b in boms:

        result.append({
            "bom_id":b.bom_id,
            "product_name":b.product_name,
            "material_id":b.material_id,
            "quantity":b.quantity
        })

    return jsonify(result)
#修改BOM
@inventory_bp.route(
    "/bom/update/<int:bom_id>",
    methods=["PUT"]
)
def update_bom(bom_id):

    bom = BOM.query.get(bom_id)

    if not bom:
        return jsonify({
            "message":"資料不存在"
        }),404

    data = request.json

    bom.product_name = data["product_name"]
    bom.material_id = data["material_id"]
    bom.quantity = data["quantity"]

    db.session.commit()

    return jsonify({
        "message":"修改成功"
    })
#刪除BOM
@inventory_bp.route(
    "/bom/delete/<int:bom_id>",
    methods=["DELETE"]
)
def delete_bom(bom_id):

    bom = BOM.query.get(bom_id)

    if not bom:
        return jsonify({
            "message":"資料不存在"
        }),404

    db.session.delete(bom)

    db.session.commit()

    return jsonify({
        "message":"刪除成功"
    })
