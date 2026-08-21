# CloudScope Web

**CloudScope Web** is a static website for viewing [CloudScope](https://mapmanager.github.io/cloudscope-app/) analysis datasets.

To use CloudScope Web, there is nothing to install or run, just open it in a browser, open a dataset, and view it.

[Open CloudScope Web](https://mapmanager.github.io/cloudscope-web/){ .md-button .md-button--primary }

## From analysis to a shareable dataset

[CloudScope](https://mapmanager.github.io/cloudscope-app/) is the macOS and Windows desktop application used to analyze imaging data. It can be used on a scope or rig while an experiment is in progress, and later for all needed offline analysis.

After analysis is done in CloudScope, the data and all analysis is exported as a **CloudScope dataset**. The export keeps the image data together with all of the analysis results using the [OME-ZARR](https://ngff.openmicroscopy.org/) file format.

The CloudScope dataset is then uploaded to a repository such as the [Dandi Archive](https://about.dandiarchive.org/), and your readers can use the CloudScope Web app to visualize all raw data and analysis as it was done in the lab.

## Reproducible analysis with AcqStore

To ensure scientific reproducibility, all analysis done in the CloudScope desktop app is driven by the Python package [AcqStore](https://mapmanager.github.io/acqstore/). Importantly, AcqStore can also be used in Python scripts and notebooks, dataset can be saved and then shared directly from these Python scripts. This is particularly useful for any future analysis needed and taps into the sharability of the CloudScope Web.

## What you can do in CloudScope Web

CloudScope Web lets you open datasets in a browser and inspect its images and analyses interactively. Depending on the dataset, you can select images, change channels, work with ROIs, adjust image display settings, inspect metadata, and view analysis plots.

A particularly useful feature is sharing. The dataset and primary selection state are stored in the CloudScope Web URL, so you can copy the browser URL and send it to a colleague.

## Getting started with CloudScope Web

- Start with [Using CloudScope Web](user-guide/using-cloudscope-web.md).
- See [Sharing a view](user-guide/sharing.md) for the copy-and-paste sharing workflow.
- See [Publishing a CloudScope dataset](publishing/index.md) for a recommended publication workflow.
