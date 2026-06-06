from extensions import db
from datetime import datetime
import pytz

class Sales(db.Model):
#欄位定義
    __tablename__ = "sales_records"

    sale_id = db.Column(
        db.String(20),
        primary_key=True
    )

    product_id = db.Column(
        db.String(10),
        db.ForeignKey("products.product_id")
    )

    qty = db.Column(db.Integer) #銷售數量

    subtotal = db.Column(db.Integer) #銷售明細的小計金額

    sale_date = db.Column(
        db.DateTime,
        default=datetime.utcnow
    )
    @property
    def sale_date_tw(self):
        """回傳台灣時間 (UTC+8)"""
        tw_tz = pytz.timezone("Asia/Taipei")
        utc_time = self.sale_date.replace(tzinfo=pytz.utc)
        return utc_time.astimezone(tw_tz)
    
    def to_dict(self):
        return {
            "sale_id": self.sale_id,
            "product_id": self.product_id,
            "qty": self.qty,
            "subtotal": self.subtotal,
            "sale_date": self.sale_date_tw.strftime(
                "%Y-%m-%d %H:%M:%S"
            )
        }