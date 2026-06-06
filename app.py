from flask import Flask, jsonify
from flask_cors import CORS
from config import Config
from extensions import db

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    
    CORS(app)
    db.init_app(app)

    with app.app_context():
        from models.Inventory import Inventory
        from models.Product import Product
        from models.Purchase import Purchase
        from models.Sales import Sales  
        from models.Supplier import Supplier
        from models.BOM import BOM
        db.create_all()

    # 在 Flask 後端寫一個大打包的 API，取代原本的 get_data.php
    @app.route("/api/get_all_data", methods=["GET"])
    def get_all_data():
        try:
          from models.Inventory import Inventory
          from models.Product import Product
          from models.Purchase import Purchase
          from models.Sales import Sales  
          from models.Supplier import Supplier
          from models.BOM import BOM

          return jsonify({
            "success": True,
            "products": [p.to_dict() for p in Product.query.all()],
            "inventory": [i.to_dict() for i in Inventory.query.all()],
            "purchaseOrders": [p.to_dict() for p in Purchase.query.all()],
            "salesRecords": [s.to_dict() for s in Sales.query.all()],
            "suppliers": [s.to_dict() for s in Supplier.query.all()],
            "bomRecords": [b.to_dict() for b in BOM.query.all()]
          })
        except Exception as e:
            return jsonify({"success": False, "message": str(e)}), 500

    # 匯入 Blueprint：Flask 的模組化路由機制
    from routes.supplier_routes import supplier_bp
    from routes.inventory_routes import inventory_bp
    from routes.purchase_routes import purchase_bp
    from routes.sales_routes import sales_bp
    from routes.forecast_routes import forecast_bp
    from routes.report_routes import report_bp

    # 註冊 Blueprint
    app.register_blueprint(supplier_bp)
    app.register_blueprint(inventory_bp)
    app.register_blueprint(purchase_bp)
    app.register_blueprint(sales_bp)
    app.register_blueprint(forecast_bp)
    app.register_blueprint(report_bp)

    return app

app = create_app()

if __name__ == "__main__":
    app.run(debug=True)