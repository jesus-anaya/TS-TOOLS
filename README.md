# TS-TOOLS
Tools to manage TS, as fill NaN, resample, normalize, standardize

NDVI complex harmonics is needed to determine a trend for this variable, high quality observations are usually below 50%

Scaler allows to compare TS of different units and dimension in a similar scale, between 0-1

Resample allows to determine temporal scale of the TS, hours, days, 6-days, monthly, etc

Iterate allows to run multiple models to find parameters generating the lowest RMSE

Non_transformed reads a TS to decompose and get Trend, seasonalty, residuals. It allows to evaluate if the TS is stationary
