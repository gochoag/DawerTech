from datetime import timedelta

from flask import Flask

from dawertech.modules.auth.infrastructure.orm_models import UserORM, utc_now
from dawertech.modules.auth.infrastructure.security import DEVICE_SESSION_EXPIRY, as_utc, issue_tokens


class TokenSession:
    def __init__(self):
        self.issued = None

    def execute(self, _statement):
        pass

    def add(self, value):
        self.issued = value

    def flush(self):
        self.issued.id = 1


def test_web_session_lasts_a_year():
    app = Flask(__name__)
    app.config['SECRET_KEY'] = 'test-secret-key-with-at-least-32-characters'
    session = TokenSession()
    before = utc_now()
    with app.app_context():
        issue_tokens(session, UserORM(id=1))
    assert as_utc(session.issued.expires_at) >= before + timedelta(days=365)


def test_remembered_device_has_no_calendar_expiry():
    app = Flask(__name__)
    app.config['SECRET_KEY'] = 'test-secret-key-with-at-least-32-characters'
    session = TokenSession()
    with app.app_context():
        tokens = issue_tokens(session, UserORM(id=1), remember_device=True)
    assert as_utc(session.issued.expires_at) == DEVICE_SESSION_EXPIRY
    assert tokens['expires_in'] == 12 * 60 * 60
