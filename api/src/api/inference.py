import joblib
from fastapi import FastAPI, Query
import pandas as pd
import numpy as np

model_uri = "../../../ml/models/FD004GBM_BAG"
data_uri = "../../../data/FE_data/test_FD004"

# Load the model
models = joblib.load(model_uri)
app = FastAPI()


# Prune test set features
def prune_features(test, drop_pc2=False):
    """Drop min/last/max/delta feature columns (and pc2 if asked) from train and test."""
    patterns = ["min", "last", "max", "delta"]
    if drop_pc2:
        patterns.append("pc2")

    to_drop = [c for c in test.columns if any(p in c for p in patterns)]

    return test.drop(columns=to_drop, errors="ignore")


df = pd.read_parquet(data_uri)
df = df.drop(columns="RUL")
df = df.set_index("Engine")
df = prune_features(df)


# Average the preditions of the bagged models
class Bag:
    def __init__(self, models):
        self.models = models

    def predict(self, X):
        return np.mean([m.predict(X) for m in self.models], axis=0)


bag = Bag(models)


@app.get("/predict")
def inference(target_idxs: list[int] = Query(...), cycles: list[int] = Query(...)):
    """Return FD004GBM model predictions for a batch of engines,
    each at its own time cycle.

    Args:
        target_idxs (list[int]): Engine indices (e.g. 1..100) to predict on.
        cycles (list[int]): Time cycle for each engine. cycles[i] belongs to
            target_idxs[i], so both lists must be the same length.

    Returns:
        dict: {"Predicted RUL": [...]} with one prediction per engine,
            in the same order as target_idxs.
    """

    lookup = dict(zip(target_idxs, cycles))
    wanted = df.index.map(lookup)
    targets = df[df["Time"] == wanted]
    targets = targets.loc[target_idxs]
    rul_pred = bag.predict(targets)

    return {"Predicted RUL": rul_pred.tolist()}
