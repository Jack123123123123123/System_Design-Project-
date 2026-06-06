from extensions import db

class Supplier(db.Model):
#欄位定義
    __tablename__ = "suppliers"

    supplier_id = db.Column(
        db.String(10),
        primary_key=True
    )

    name = db.Column(db.String(50))

    phone = db.Column(db.String(20))

    contact = db.Column(db.String(20))

    address = db.Column(db.String(100))

    def to_dict(self):
        return {
            "supplier_id": self.supplier_id,
            "name": self.name,
            "phone": self.phone,
            "contact": self.contact,
            "address": self.address
        }
    