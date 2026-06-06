from extensions import db

class BOM(db.Model):
#欄位定義
    __tablename__ = "bom"

    product_id = db.Column(
        db.String(10),
        db.ForeignKey("products.product_id"),
        primary_key=True
    )

    material_id = db.Column(
        db.String(10),
        db.ForeignKey("inventories.material_id"),
        primary_key=True
    )

    consume_qty = db.Column(db.Float)

    def to_dict(self):
        return {
            "product_id": self.product_id,
            "material_id": self.material_id,
            "consume_qty": self.consume_qty
        }