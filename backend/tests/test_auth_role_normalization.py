from app.core.auth.entra import AuthUser


def test_auth_user_treats_b2b_admin_role_case_insensitively():
    user = AuthUser(
        sub="user-1",
        name="B2B Admin",
        preferred_username="b2b.admin@example.com",
        roles=(" b2b_admin ",),
        claims={"roles": [" b2b_admin "]},
    )

    assert user.has_any_role(("B2B_ADMIN",)) is True
    assert user.has_any_role(("CX_SUPER_ADMIN", "B2B_ADMIN")) is True


def test_auth_user_treats_super_admin_role_case_insensitively():
    user = AuthUser(
        sub="user-2",
        name="Super Admin",
        preferred_username="super.admin@example.com",
        roles=("cx_super_admin",),
        claims={"roles": ["cx_super_admin"]},
    )

    assert user.is_super_admin is True
    assert user.has_any_role(("B2B_ADMIN",)) is True
