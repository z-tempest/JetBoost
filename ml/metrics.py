import numpy as np


def cmapss_score(y_true, y_pred):
    d = np.asarray(y_pred) - np.asarray(y_true)
    return np.sum(np.where(d < 0, np.exp(-d / 13) - 1, np.exp(d / 10) - 1))


def cmapss_objective(y_true, preds):
    """
    Custom objective matching the CMAPSS asymmetric exponential penalty,
    for use with the sklearn XGBRegressor API (not the native Booster API).
    d = pred - true. Penalizes d > 0 (late prediction / RUL overestimate)
    more steeply than d < 0.
    """
    d = preds - y_true

    grad = np.where(d < 0, -(1 / 13) * np.exp(-d / 13), (1 / 10) * np.exp(d / 10))
    hess = np.where(d < 0, (1 / 169) * np.exp(-d / 13), (1 / 100) * np.exp(d / 10))

    return grad, hess
