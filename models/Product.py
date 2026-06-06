from extensions import db

class Product(db.Model):
#欄位定義
    __tablename__ = "products"

    product_id = db.Column(
        db.String(10),
        primary_key=True
    )

    product_name = db.Column(db.String(30))

    price = db.Column(db.Integer)

    def to_dict(self):
        return {
            "product_id": self.product_id,
            "product_name": self.product_name,
            "price": self.price
        }