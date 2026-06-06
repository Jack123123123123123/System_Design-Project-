class Config:
    SECRET_KEY = "coolnoodle"

    SQLALCHEMY_DATABASE_URI = (
        "mysql+pymysql://root:123456@localhost/coolnoodle"
    ) #設定資料庫的連線位址 
      #透過 pymysql 驅動程式，以 root 身分（密碼為 123456）連接到本機上的 coolnoodle 資料庫。

    SQLALCHEMY_TRACK_MODIFICATIONS = False