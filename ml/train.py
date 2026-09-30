import numpy as np
import pandas as pd
import optuna
import joblib
import metrics
import utils
from xgboost import XGBRegressor
from sklearn.model_selection import train_test_split, GroupKFold
from sklearn.utils.class_weight import compute_sample_weight
from imblearn.pipeline import Pipeline as ImbPipeline
from skopt.space import Real, Integer
from sklearn.metrics import root_mean_squared_error, make_scorer

pd.set_option("display.max_columns", None)
np.random.seed(1)

# train_df = pd.read_parquet('path')
# train_df = train1.set_index('Engine')

# test_df = pd.read_parquet('path')
# test_df = train1.set_index('Engine')


def objective(trial):
    # Suggest a search space for XGBoost regression hyperparameters
    params = {
        "objective": metrics.cmapss_objective,
        "n_estimators": trial.suggest_int("n_estimators", 100, 1000),
        "n_jobs": -1,
        "verbosity": 0,
        "max_depth": trial.suggest_int("max_depth", 3, 10),
        "learning_rate": trial.suggest_float("learning_rate", 0.001, 0.3, log=True),
        "subsample": trial.suggest_float("subsample", 0.3, 1.0),
        "colsample_bytree": trial.suggest_float("colsample_bytree", 0.3, 1.0),
        "min_child_weight": trial.suggest_int("min_child_weight", 1, 10),
        "gamma": trial.suggest_float("gamma", 0, 5),
        "reg_alpha": trial.suggest_float("reg_alpha", 1e-8, 10.0, log=True),
        "reg_lambda": trial.suggest_float("reg_lambda", 1e-8, 10.0, log=True),
        "random_state": 42,
        "device": "cuda",
        "early_stopping_rounds": 50,
    }

    # Cross-validation setup to avoid overfitting
    groups = X_train.index  # engine id
    gkf = GroupKFold(n_splits=5)
    scores = []

    for train_idx, val_idx in gkf.split(X_train, y_train, groups=groups):
        X_tr, X_val = X_train.iloc[train_idx], X_train.iloc[val_idx]
        y_tr, y_val = y_train.iloc[train_idx], y_train.iloc[val_idx]

        model = XGBRegressor(**params)
        model.fit(X_tr, y_tr, eval_set=[(X_val, y_val)], verbose=10)

        preds = model.predict(X_val)
        score = metrics.cmapss_score(y_val, preds)
        scores.append(score)

    # Return the average validation metric to minimize
    return np.mean(scores)


X_train, y_train = utils.make_set("""train_df""")
train_df_study = optuna.create_study(direction="minimize")
train_df_study.optimize(objective, n_trials=300)

print(train_df_study.best_trial)

best_params = train_df_study.best_params
best_params.update(
    {
        "n_jobs": 1,
        "verbosity": 0,
        "random_state": 42,
        "device": "cuda",
    }
)

train_df_model = XGBRegressor(**best_params)
train_df_model.fit(X_train, y_train)

joblib.dump(train_df_model, "/path/train_df_model")
