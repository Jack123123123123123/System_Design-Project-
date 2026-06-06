from extensions import db

class Inventory(db.Model):
#欄位定義
    __tablename__ = "inventories"

    material_id = db.Column(
        db.String(10),
        primary_key=True
    )

    material_name = db.Column(db.String(30))

    stock = db.Column(db.Integer)

    safe_stock = db.Column(db.Integer)

    unit = db.Column(db.String(10)) #計量單位

    def to_dict(self):
        return {
            "material_id": self.material_id,
            "material_name": self.material_name,
            "stock": self.stock,
            "safe_stock": self.safe_stock,
            "unit": self.unit
        }