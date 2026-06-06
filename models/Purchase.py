from extensions import db
from datetime import datetime
import pytz

class Purchase(db.Model):

    __tablename__ = "purchase_orders"

    purchase_id = db.Column(
        db.String(20),
        primary_key=True
    )

    supplier_id = db.Column(
        db.String(10),
        db.ForeignKey("suppliers.supplier_id")
    )

    material_id = db.Column(
        db.String(10),
        db.ForeignKey("inventories.material_id")
    )

    qty = db.Column(db.Integer)

    status = db.Column(db.String(20))

    purchase_date = db.Column(
        db.DateTime,
        default=datetime.utcnow
    )

    @property
    def purchase_date_tw(self):

        tw_tz = pytz.timezone("Asia/Taipei")

        utc_time = self.purchase_date.replace(
            tzinfo=pytz.utc
        )

        return utc_time.astimezone(tw_tz)

    def to_dict(self):
        return {
            "purchase_id": self.purchase_id,
            "supplier_id": self.supplier_id,
            "material_id": self.material_id,
            "qty": self.qty,
            "status": self.status,
            "purchase_date": self.purchase_date_tw.strftime(
                "%Y-%m-%d %H:%M:%S"
            )
        }
    