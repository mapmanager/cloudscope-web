# Using CloudScope Web

This page covers the main workflow for viewing a CloudScope analysis dataset.

## 1. Open CloudScope Web

Open:

**https://mapmanager.github.io/cloudscope-web/**

CloudScope Web is a static website. There is nothing to install or start on your computer for normal viewing.

## 2. Open a dataset

Use **Open collection** in the CloudScope Web header.

You can either choose one of the provided sample datasets or paste the root URL of a published CloudScope analysis dataset and choose **Open URL**.

After the dataset loads, CloudScope Web displays the collection and its available images.

## 3. Choose an image

The collection table provides an overview of the images in the dataset. Select a row to open that image.

The table can include information such as image dimensions, channel count, ROI count, available analyses, acquisition information, and whether a reference image is available.

## 4. Work with the image viewer

Use the image viewer to inspect the selected image. The controls available depend on the image, but can include:

- pan and zoom
- channel selection
- multi-channel display
- contrast and LUT controls
- ROI overlays and ROI selection

!!! tip "Familiar controls for CloudScope users"
    The image viewer in CloudScope Web uses the same viewer code as the desktop [CloudScope](https://mapmanager.github.io/cloudscope-app/), so its core image interaction and display controls should feel familiar to existing CloudScope users.

## 5. Select a channel and ROI

For multi-channel data, choose the channel you want to view. If the image contains ROIs, select the ROI associated with the analysis you want to view.

CloudScope Web uses the selected channel and ROI to show the analyses that apply to that part of the dataset.

## 6. View analysis results

Analysis plots appear for analyses exported with the selected image, channel, and ROI.

The current viewer includes registered plots for:

- Diameter
- Summed intensity
- Radon velocity

A dataset does not need to contain every analysis type. CloudScope Web shows the results that were exported with that dataset.

## 7. Inspect metadata

Use the left toolbar to inspect information associated with the selected image and experiment. CloudScope Web currently provides inspectors for image-header and experiment metadata.

These views are useful when you need more context about how an image was acquired or how it fits into the larger dataset.

## 8. Share what you are viewing

Once you have selected the dataset, image, channel, and ROI you want to discuss, copy the URL from the browser address bar and send it to a coleague.

See [Sharing a view](sharing.md) for the recommended sharing workflow and details about what the current URL restores.
