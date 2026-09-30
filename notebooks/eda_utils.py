import numpy as np
import pandas as pd
from sklearn.decomposition import PCA

def dropcols(df):
    """ Drops cols that are not relevant for degredation charts
        Args:
            df (Pandas DataFrame): Target DataFrame to drop cols

        Returns:
            droppedcols (Pandas DataFrame): Release DataFrame with removed cols.
    """
    columns_to_drop = [
        'Time',
        'Setting1',
        'Setting2',
        'Setting3',
        'RUL'
    ]

    droppedcols = df.drop(columns=columns_to_drop, axis=1)

    return droppedcols


def drop_constant_cols(sensors, drop, engine_id=None):
    """ Drops constant values in correlation_view when specified to do so.

        Args:
            sensors (pandas DataFrame): The input Data for sensor values.

            drop (Boolean): The Bool for wether or not drops were requested.

            engine_id (Integer): The index of a targeted engine.

        Returns:
            sensors (Pandas DataFrame): The target DataFrame that is returned
            unmodified if drops were not requested or with the requested
            constant value columns dropped if requested.
    """
    if not drop:
        return sensors

    if engine_id is None:
        constants = [
            col for col in sensors.columns if np.max(sensors[col]) - np.min(sensors[col]) == 0
        ]

        sensors = sensors.drop(columns=constants, axis=1)
    else:
        sensors = sensors.loc[engine_id]

        constants = [
            col for col in sensors.columns if np.max(sensors[col]) - np.min(sensors[col]) == 0
        ]

        sensors = sensors.drop(columns=constants, axis=1)

    return sensors

def sensor_pca(df, n_components=1):
    """Fit PCA on a sensor dataframe and return the requested components,
    indexed by Engine.

    Args:
        df (pandas.DataFrame): Z-scored sensor columns, one row per (Engine, cycle).
        n_components (int): Number of principal components to retain.
            Defaults to 1 for backward compatibility with existing callers.

    Returns:
        pandas.DataFrame: One column per component
            ("Principal Component Sensors (PC1)", "...(PC2)", etc.),
            indexed by Engine.
    """
    pca = PCA(n_components=n_components)
    sensorpca = pca.fit_transform(df)  # shape: (n_rows, n_components)

    idx = df.index
    pca_df = pd.DataFrame(idx)

    # sensorpca is 2D even when n_components == 1, so index columns explicitly
    # rather than assigning the whole array to one column.
    for i in range(n_components):
        pca_df[f'Principal Component Sensors (PC{i + 1})'] = sensorpca[:, i]

    pca_df = pca_df.set_index('Engine')

    return pca_df


def get_failed(df):
    failed = len(df.loc[df['RUL'] == 0])
    life_remaining = len(df.index.unique()) - failed

    return failed, life_remaining