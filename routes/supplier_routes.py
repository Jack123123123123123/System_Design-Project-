from flask import Blueprint
from flask import request
from flask import jsonify

from extensions import db

from models.Supplier import Supplier

supplier_bp = Blueprint(
    "supplier",
    __name__
)

# 新增供應商
@supplier_bp.route(
    "/supplier/add", #API 路徑
    methods=["POST"] #只允許 POST(新增資料)
)#將 URL網址與函式綁定
def Add_supplier():
#取得前端送來的 JSON 資料
    data = request.json
#將 JSON 中的欄位對應到 Supplier
    supplier = Supplier(
        supplier_id=data["supplier_id"],
        name=data["name"],
        phone=data["phone"],
        contact=data["contact"],
        address=data["address"]
    )

    db.session.add(supplier)

    db.session.commit()

    return jsonify({
        "message": "新增成功"
    })

# 查詢供應商
@supplier_bp.route("/supplier/list")
def list_supplier():

    suppliers = Supplier.query.all()

    result = []

    for s in suppliers:

        result.append({
            "supplier_id": s.supplier_id,
            "name": s.name,
            "phone": s.phone
        })

    return jsonify(result)
# 查詢單一供應商
@supplier_bp.route(
    "/supplier/<supplier_id>",
    methods=["GET"]
)
def get_supplier(supplier_id):

    supplier = Supplier.query.get(supplier_id)

    if not supplier:
        return jsonify({
            "message": "供應商不存在"
        }), 404

    return jsonify({
        "supplier_id": supplier.supplier_id,
        "name": supplier.name,
        "phone": supplier.phone,
        "contact": supplier.contact,
        "address": supplier.address
    })
# 修改供應商
@supplier_bp.route(
    "/supplier/update/<supplier_id>",
    methods=["PUT"]
)
def update_supplier(supplier_id):

    supplier = Supplier.query.get(supplier_id)

    if not supplier:
        return jsonify({
            "message": "供應商不存在"
        }), 404

    data = request.json

    supplier.name = data["name"]
    supplier.phone = data["phone"]
    supplier.contact = data["contact"]
    supplier.address = data["address"]

    db.session.commit()

    return jsonify({
        "message": "修改成功"
    })
# 刪除供應商
@supplier_bp.route(
    "/supplier/delete/<supplier_id>",
    methods=["DELETE"]
)
def delete_supplier(supplier_id):

    supplier = Supplier.query.get(supplier_id)

    if not supplier:
        return jsonify({
            "message": "供應商不存在"
        }), 404

    db.session.delete(supplier)

    db.session.commit()

    return jsonify({
        "message": "刪除成功"
    })
#錯誤處理
@supplier_bp.route(
    "/supplier/add",
    methods=["POST"]
)
def add_supplier():

    data = request.json

    supplier = Supplier.query.get(
        data["supplier_id"]
    )

    if supplier:
        return jsonify({
            "message":"供應商編號已存在"
        }),400

    new_supplier = Supplier(
        supplier_id=data["supplier_id"],
        name=data["name"],
        phone=data["phone"],
        contact=data["contact"],
        address=data["address"]
    )

    db.session.add(new_supplier)
    db.session.commit()

    return jsonify({
        "message":"新增成功"
    })
