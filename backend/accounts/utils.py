import secrets

def generate_otp():
    # secrets.randbelow is cryptographically secure; random.randint is NOT
    return str(secrets.randbelow(90000) + 10000)