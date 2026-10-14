import numpy as np
from xgboost import XGBRegressor
from ml.metrics import cmapss_score
from sklearn.metrics import root_mean_squared_error
import utils
import joblib
from sklearn.model_selection import GroupKFold

# specify train set
train = ???

# specify test set
test = ???

# split training set
X_train, y_train = utils.make_set(train)


# Uncomment one hyperparameter dictionary to use one with its -
# corresponding test and train set in order to bag models -
# seed 0 : 25

'''
# FD001
best_params = {
    "n_estimators": 882,
    "max_depth": 10,
    "learning_rate": 0.03152919671973775,
    "subsample": 0.7077757619355042,
    "colsample_bytree": 0.4984065878765089,
    "min_child_weight": 5,
    "gamma": 0.27497368264149147,
    "reg_alpha": 9.401082487406983e-07,
    "reg_lambda": 7.241239786440861e-08,
}

# FD002


# FD003
best_params = {
    "n_estimators": 928,
    "max_depth": 9,
    "learning_rate": 0.019798162000565157,
    "subsample": 0.3114275344910976,
    "colsample_bytree": 0.5074337115665735,
    "min_child_weight": 1,
    "gamma": 0.2131661971470415,
    "reg_alpha": 1.1862235902292198e-06,
    "reg_lambda": 9.1788346524956e-06,
}

# FD004
best_params = {
    "n_estimators": 830,
    "max_depth": 3,
    "learning_rate": 0.11964180446586732,
    "subsample": 0.31103011279908493,
    "colsample_bytree": 0.7778531747932206,
    "min_child_weight": 10,
    "gamma": 0.4202883207170731,
    "reg_alpha": 1.757945428711076e-08,
    "reg_lambda": 9.211294559031087,
}
'''

seeds = range(25)
all_preds = []
all_scores = []
all_rmse = []
models = []

for seed in seeds:
    GBM = XGBRegressor(**best_params, random_state=seed)
    models.append(GBM)
    GBM.fit(X_train, y_train)
    GBM.set_params(device="cpu")

    scoreable_test = test.dropna(subset=["RUL"])
    X_test = scoreable_test.drop(columns=["RUL"])
    y_test = scoreable_test["RUL"]
    preds = GBM.predict(X_test)
    all_preds.append(preds)
    # NASA score (Asymetric loss)
    score = cmapss_score(y_test, preds)
    all_scores.append(score)
    # RMSE in cycles, lower is better
    rmse = root_mean_squared_error(y_test, preds)
    all_rmse.append(rmse)

    print("NASA S Score:", score)
    print("RMSE:", rmse)

print("Mean S Score:", np.mean(all_scores))
print("Max S Score:", max(all_scores))
print("Min S Score:", min(all_scores))
print("S Score Variance:", np.var(all_scores))

print("Mean RMSE:", np.mean(all_rmse))
print("Max RMSE:", max(all_rmse))
print("Min RMSE:", min(all_rmse))
print("RMSE Variance:", np.var(all_rmse))

# Out of fold predictions on train grouped by engine
groups = X_train.index
oof = np.zeros(len(y_train))
for tr, va in GroupKFold(n_splits=5).split(X_train, y_train, groups):
    m = XGBRegressor(**best_params, random_state=0)
    m.fit(X_train.iloc[tr], y_train.iloc[tr])
    oof[va] = m.predict(X_train.iloc[va])

# Pick the shift (in cycles) that gives the lowest NASA score on those OOF preds
shifts = np.arange(0, 11, 0.5)
shift = shifts[np.argmin([cmapss_score(y_train, oof - s) for s in shifts])]
print("shift:", shift)

#Bag 25 test predictions, shift, clip at 0, score once
bag = np.mean(all_preds, axis=0)
final = np.clip(bag - shift, 0, None)
print("score:", cmapss_score(y_test, final))
print("RMSE: ", root_mean_squared_error(y_test, final))


joblib.dump(models, "path")
