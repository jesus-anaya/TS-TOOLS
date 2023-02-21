//GEE
//COMPLEX TIME SERIES MODELLING.

//https://developers.google.com/earth-engine/tutorials/community/time-series-modeling
//https://code.earthengine.google.com/f2f03989555d31cad7b532787531f275
//https://code.earthengine.google.com/f2f03989555d31cad7b532787531f275


/**
 * @license
 * Copyright 2022 The Google Earth Engine Community Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * 
 * @description
 * This script accompanies the Earth Engine Community tutorial
 * "Time Series Modeling" (https://developers.google.com/earth-engine/tutorials/community/time-series-modeling).
 * It demonstrates using multiple sinusoids to build a complex harmonic model
 * for a Landsat 8 time series.
 */

// Import Landsat 8 image collection and define region of interest.
var landsat8Sr = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2');
var roi = ee.Geometry.Point([-75.09867, 9.93441]);

// The dependent variable we are modeling.
var dependent = 'NDVI';

// The number of cycles per year to model.
var harmonics = 3;

// Make a list of harmonic frequencies to model.  
// These also serve as band name suffixes.
var harmonicFrequencies = ee.List.sequence(1, harmonics);

// Function to get a sequence of band names for harmonic terms.
var getNames = function(base, list) {
  return ee.List(list).map(function(i) { 
    return ee.String(base).cat(ee.Number(i).int());
  });
};

// Construct lists of names for the harmonic terms.
var cosNames = getNames('cos_', harmonicFrequencies);
var sinNames = getNames('sin_', harmonicFrequencies);

// Independent variables.
var independents = ee.List(['constant', 't']).cat(cosNames).cat(sinNames);

// Function to mask clouds in Landsat 8 imagery.
var maskL8sr = function(image) {
  // Bit 0 - Fill
  // Bit 1 - Dilated Cloud
  // Bit 2 - Cirrus
  // Bit 3 - Cloud
  // Bit 4 - Cloud Shadow
  var qaMask = image.select('QA_PIXEL').bitwiseAnd(parseInt('11111', 2)).eq(0);
  var saturationMask = image.select('QA_RADSAT').eq(0);

  // Apply the scaling factors to the appropriate bands.
  var opticalBands = image.select('SR_B.').multiply(0.0000275).add(-0.2);
  var thermalBands = image.select('ST_B.*').multiply(0.00341802).add(149.0);

  // Replace the original bands with the scaled ones and apply the masks.
  return image.addBands(opticalBands, null, true)
    .addBands(thermalBands, null, true)
    .updateMask(qaMask)
    .updateMask(saturationMask);
};

// Function to add an NDVI band, the dependent variable.
var addNDVI = function(image) {
  return image
    .addBands(image.normalizedDifference(['SR_B5', 'SR_B4'])
    .rename('NDVI'))
    .float();
};

// Function to add a constant band.
var addConstant = function(image) {
  return image.addBands(ee.Image(1));
};

// Function to add a time band.
var addTime = function(image) {
  // Compute time in fractional years since the epoch.
  var date = image.date();
  var years = date.difference(ee.Date('1970-01-01'), 'year');
  var timeRadians = ee.Image(years.multiply(2 * Math.PI));
  return image.addBands(timeRadians.rename('t').float());
};

// Function to compute the specified number of harmonics
// and add them as bands. Assumes the time band is present.
var addHarmonics = function(freqs) {
  return function(image) {
    // Make an image of frequencies.
    var frequencies = ee.Image.constant(freqs);
    // This band should represent time in radians.
    var time = ee.Image(image).select('t');
    // Get the cosine terms.
    var cosines = time.multiply(frequencies).cos().rename(cosNames);
    // Get the sin terms.
    var sines = time.multiply(frequencies).sin().rename(sinNames);
    return image.addBands(cosines).addBands(sines);
  };
};

// Filter to the area of interest, mask clouds, add variables.
var harmonicLandsat = landsat8Sr
  .filterBounds(roi)
  .filterDate('2018', '2019')
  .map(maskL8sr)
  .map(addNDVI)
  .map(addConstant)
  .map(addTime)
  .map(addHarmonics(harmonicFrequencies));
  
// The output of the regression reduction is a 4x1 array image.
var harmonicTrend = harmonicLandsat
  .select(independents.add(dependent))
  .reduce(ee.Reducer.linearRegression(independents.length(), 1));

// Turn the array image into a multi-band image of coefficients.
var harmonicTrendCoefficients = harmonicTrend.select('coefficients')
  .arrayProject([0])
  .arrayFlatten([independents]);

// Compute fitted values.
var fittedHarmonic = harmonicLandsat.map(function(image) {
  return image.addBands(
    image.select(independents)
      .multiply(harmonicTrendCoefficients)
      .reduce('sum')
      .rename('fitted'));
});

// Plot the fitted model and the original data at the ROI.
print(ui.Chart.image.series(
  fittedHarmonic.select(['fitted', 'NDVI']), roi, ee.Reducer.mean(), 30)
    .setOptions({
      title: 'Harmonic model: original and fitted values',
      lineWidth: 1,
      pointSize: 3
    })
);

// Display the ROI and NDVI composite on the map.
Map.centerObject(roi, 11);
Map.addLayer(harmonicLandsat,
  {bands: 'NDVI', min: 0.1, max: 0.9, palette: ['white', 'green']},
  'NDVI Mosaic');
Map.addLayer(roi, {color: 'yellow'}, 'ROI');
