from extensions import db

class ScrapRecord(db.Model):

    __tablename__ = "scrap_record"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    material_id = db.Column(
        db.String(10)
    )

    material_name = db.Column(
        db.String(50)
    )

    quantity = db.Column(
        db.Integer
    )

    reason = db.Column(
        db.String(100)
    )

    scrap_date = db.Column(
        db.DateTime
    )

    def to_dict(self):
        return {
            "id": self.id,
            "material_id": self.material_id,
            "material_name": self.material_name,
            "quantity": self.quantity,
            "reason": self.reason,
            "scrap_date": self.scrap_date.strftime(
                "%Y-%m-%d %H:%M:%S"
            ) if self.scrap_date else None
        }
    