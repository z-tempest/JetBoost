def cap_rul(df, clip=100):
    """
    Cap the RUL target at 125 (piecewise-linear ceiling).
    Rows above 125 get pulled down to 125; rows already below pass through unchanged.
    """
    df["RUL"] = df["RUL"].clip(upper=clip)

    return df


def make_set(df):
    df = cap_rul(df, 125)
    X_train = df.drop(columns="RUL")
    y_train = df["RUL"]

    return X_train, y_train
